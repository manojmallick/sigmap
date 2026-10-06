# Standalone script: it lives outside `lib/`, the only indexed source root.
require_relative '../lib/shop/catalog'

def export_report(catalog, path)
  File.write(path, catalog.export_rows.map { |row| row.join(',') }.join("\n"))
end

export_report(Shop::Catalog.new, 'report.csv') if $PROGRAM_NAME == __FILE__
