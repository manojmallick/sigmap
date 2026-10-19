# Ground truth for scripts/extraction-recall/ruby.mjs: the classes, modules and methods that
# Ruby's own parser (Ripper) finds in each file named on the command line.
#
#   ruby ruby-ripper.rb file.rb [file.rb ...]   # prints one JSON object: { file => [[kind, name], ...] }
#
# kind is "class", "module" or "method". A class or module name is the bare constant (the last
# segment of `A::B`); a method is "Owner#name" (instance), "Owner.name" (def self.name / def X.name)
# or just "name" outside any class. Files Ripper cannot parse (Ruby 2.6 rejects modern syntax)
# are left out of the object, and the comparison leaves them out on both sides.
# Dev-only: nothing here ships in the npm package, and nothing at runtime depends on Ruby.
require 'ripper'
require 'json'

def walk(n, out, cls)
  return unless n.is_a?(Array)
  case n[0]
  when :def
    nm = n[1].is_a?(Array) ? n[1][1] : nil
    out << ['method', (cls ? "#{cls}##{nm}" : nm)] if nm
  when :defs
    nm = n[3].is_a?(Array) ? n[3][1] : nil
    out << ['method', (cls ? "#{cls}.#{nm}" : nm)] if nm
  when :class, :module
    cr = n[1]
    nm = nil
    if cr.is_a?(Array)
      if cr[0] == :const_ref then nm = cr[1][1]
      elsif cr[0] == :const_path_ref then nm = cr[2][1]
      elsif cr[0] == :top_const_ref then nm = cr[1][1] end
    end
    if nm
      out << [n[0].to_s, nm]
      n.each { |c| walk(c, out, nm) }
      return
    end
  end
  n.each { |c| walk(c, out, cls) }
end

res = {}
ARGV.each do |f|
  begin
    src = File.read(f, encoding: 'UTF-8', invalid: :replace, undef: :replace)
    sx = Ripper.sexp(src)
    next unless sx
    out = []
    walk(sx, out, nil)
    res[f] = out
  rescue StandardError
    # an unreadable file is simply not compared
  end
end
puts JSON.generate(res)
