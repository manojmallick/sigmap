# Ground truth for scripts/extraction-recall/ruby.mjs: the classes, modules and methods that
# Ruby's own parser (Ripper) finds in each file named on the command line.
#
#   ruby ruby-ripper.rb file.rb [file.rb ...]   # prints one JSON object: { file => [[kind, name, first_line, last_line], ...] }
#
# kind is "class", "module" or "method"; the two numbers are the 1-based lines the definition
# starts and ends on (the line of its name, and the line of the `end` that closes it; an endless
# `def f = x` ends where its expression does). A class or module name is the bare constant (the last
# segment of `A::B`); a method is "Owner#name" (instance), "Owner.name" (def self.name / def X.name)
# or just "name" outside any class. Files Ripper cannot parse (Ruby 2.6 rejects modern syntax)
# are left out of the object, and the comparison leaves them out on both sides.
# Dev-only: nothing here ships in the npm package, and nothing at runtime depends on Ruby.
require 'ripper'
require 'json'

# Ripper reports where a construct STARTS (the name's position) but not where it ends. The parser
# event for a definition fires when the parser has reduced it, i.e. just after its closing `end`,
# so the lexer's line at that moment is the end line. Nodes are tracked by identity.
class Ends < Ripper::SexpBuilder
  attr_reader :ends
  def initialize(*args)
    super
    @ends = {}
  end
  %i[def defs class module].each do |ev|
    define_method("on_#{ev}") do |*args|
      node = super(*args)
      @ends[node.object_id] = lineno
      node
    end
  end
end

def line_of(tok)
  tok.is_a?(Array) && tok[2].is_a?(Array) ? tok[2][0] : nil
end

def walk(n, out, cls, ends)
  return unless n.is_a?(Array)
  case n[0]
  when :def
    nm = n[1].is_a?(Array) ? n[1][1] : nil
    out << ['method', (cls ? "#{cls}##{nm}" : nm), line_of(n[1]), ends[n.object_id]] if nm
  when :defs
    nm = n[3].is_a?(Array) ? n[3][1] : nil
    out << ['method', (cls ? "#{cls}.#{nm}" : nm), line_of(n[3]), ends[n.object_id]] if nm
  when :class, :module
    cr = n[1]
    nm = nil
    tok = nil
    if cr.is_a?(Array)
      if cr[0] == :const_ref then tok = cr[1]
      elsif cr[0] == :const_path_ref then tok = cr[2]
      elsif cr[0] == :top_const_ref then tok = cr[1] end
      nm = tok[1] if tok.is_a?(Array)
    end
    if nm
      out << [n[0].to_s, nm, line_of(tok), ends[n.object_id]]
      n.each { |c| walk(c, out, nm, ends) }
      return
    end
  end
  n.each { |c| walk(c, out, cls, ends) }
end

res = {}
ARGV.each do |f|
  begin
    src = File.read(f, encoding: 'UTF-8', invalid: :replace, undef: :replace)
    b = Ends.new(src)
    sx = b.parse
    next if sx.nil? || b.error?
    out = []
    walk(sx, out, nil, b.ends)
    res[f] = out
  rescue StandardError
    # an unreadable file is simply not compared
  end
end
puts JSON.generate(res)
