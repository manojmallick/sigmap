# Restocking and discounts

The catalog lives in `lib/shop/catalog.rb`: add stock with `add_item(sku, price)` and `restock_warehouse(sku, quantity)`, and hold it with `reserve_stock(sku, quantity)`.
Price changes go through `apply_bulk_discounts(percent)`; expired items leave with `purge_expired(before)`, and counts are refreshed by `recount_stock(sku)`.
The nightly CSV is produced by `export_reports(catalog, path)`, and every change is logged in `lib/shop/audit_log.rb`.
