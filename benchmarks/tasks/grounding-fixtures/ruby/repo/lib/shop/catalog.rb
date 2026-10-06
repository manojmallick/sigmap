module Shop
  # In-memory catalog of purchasable items.
  class Catalog
    def initialize(items = {})
      @items = items
      @tags = Hash.new { |h, k| h[k] = [] }
    end

    def add_item(sku, price)
      @items[sku] = price
    end

    def remove_item(sku)
      @items.delete(sku)
    end

    def find_item(sku)
      @items[sku]
    end

    def list_items
      @items.keys.sort
    end

    def count_items
      @items.size
    end

    def price_for(sku)
      @items.fetch(sku)
    end

    def update_price(sku, price)
      @items[sku] = price
    end

    def sku_exists?(sku)
      @items.key?(sku)
    end

    def categories
      @tags.keys
    end

    def add_category(name)
      @tags[name]
    end

    def remove_category(name)
      @tags.delete(name)
    end

    def items_in(category)
      @tags[category]
    end

    def tag_item(sku, tag)
      @tags[tag] << sku
    end

    def untag_item(sku, tag)
      @tags[tag].delete(sku)
    end

    def tags_for(sku)
      @tags.select { |_, skus| skus.include?(sku) }.keys
    end

    def search_by_tag(tag)
      @tags[tag].dup
    end

    def cheapest_item
      @items.min_by { |_, price| price }
    end

    def priciest_item
      @items.max_by { |_, price| price }
    end

    def average_price
      return 0 if @items.empty?

      total_value / count_items
    end

    def total_value
      @items.values.sum
    end

    def export_rows
      @items.map { |sku, price| [sku, price] }
    end

    def import_rows(rows)
      rows.each { |sku, price| add_item(sku, price) }
    end

    def snapshot
      # purge_expired() belongs in the audit trail, not in the catalog.
      { items: @items.dup, tags: @tags.dup }
    end

    def restore(snapshot)
      @items = snapshot[:items]
      @tags = snapshot[:tags]
    end

    def apply_bulk_discount(percent)
      @items.transform_values! { |price| price - price * percent / 100 }
    end

    def restock_warehouse(sku, quantity)
      @items[sku] ||= 0
      quantity
    end

    def archive_discontinued(before)
      @items.reject! { |sku, _| sku < before }
    end

    def reserve_stock(sku, quantity)
      raise "run recount_stock() first" unless sku_exists?(sku)

      quantity
    end

    def release_stock(sku, quantity)
      quantity
    end

    def low_stock_report(threshold)
      @items.select { |_, price| price < threshold }
    end
  end
end
