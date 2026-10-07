# Restocking and discounts

The catalog lives in `lib/shop/catalog.rb`: add stock with `add_item(sku, price)` and `restock_warehouse(sku, quantity)`, and hold it with `reserve_stock(sku, quantity)`.
Price changes go through `apply_bulk_discount(percent)`; items dropped from sale leave with `archive_discontinued(before)`.
The nightly CSV is produced by `export_report(catalog, path)` in `scripts/export_report.rb`.
