# wms — module facts (generated, do not edit)
<!-- generated from @open-mercato/core 0.6.7 — R1 staleness stamp -->

## Entities

| Entity ID | Class | Table | Editable | CustomFields |
|---|---|---|---|---|
| wms:warehouse | Warehouse | wms_warehouses | no | yes |
| wms:warehouse_zone | WarehouseZone | wms_warehouse_zones | no | yes |
| wms:warehouse_location | WarehouseLocation | wms_warehouse_locations | no | yes |
| wms:product_inventory_profile | ProductInventoryProfile | wms_product_inventory_profiles | no | yes |
| wms:inventory_lot | InventoryLot | wms_inventory_lots | no | yes |
| wms:inventory_balance | InventoryBalance | wms_inventory_balances | no | yes |
| wms:inventory_reservation | InventoryReservation | wms_inventory_reservations | no | yes |
| wms:sales_order_warehouse_assignment | SalesOrderWarehouseAssignment | wms_sales_order_warehouse_assignments | no | no |
| wms:inventory_movement | InventoryMovement | wms_inventory_movements | no | yes |

## Events  (27)

| ID | Category | Entity |
|---|---|---|
| wms.warehouse.created | crud | warehouse |
| wms.warehouse.updated | crud | warehouse |
| wms.zone.created | crud | zone |
| wms.zone.updated | crud | zone |
| wms.location.created | crud | location |
| wms.location.updated | crud | location |
| wms.inventory_profile.created | crud | inventory_profile |
| wms.inventory_profile.updated | crud | inventory_profile |
| wms.inventory_balance.created | crud | inventory_balance |
| wms.inventory_balance.updated | crud | inventory_balance |
| wms.inventory_balance.deleted | crud | inventory_balance |
| wms.inventory_reservation.created | crud | inventory_reservation |
| wms.inventory_reservation.updated | crud | inventory_reservation |
| wms.inventory_reservation.deleted | crud | inventory_reservation |
| wms.inventory_movement.created | crud | inventory_movement |
| wms.inventory_movement.updated | crud | inventory_movement |
| wms.inventory_movement.deleted | crud | inventory_movement |
| wms.inventory.received | custom | inventory |
| wms.inventory.adjusted | custom | inventory |
| wms.inventory.reserved | custom | inventory |
| wms.inventory.released | custom | inventory |
| wms.inventory.allocated | custom | inventory |
| wms.inventory.moved | custom | inventory |
| wms.inventory.reconciled | custom | inventory |
| wms.inventory.low_stock | lifecycle | inventory |
| wms.inventory.balance_drift | lifecycle | inventory |
| wms.inventory.reservation_shortfall | lifecycle | inventory |

## ACL features  (10)

wms.view · wms.manage_warehouses · wms.manage_zones · wms.manage_locations · wms.manage_inventory · wms.manage_reservations · wms.adjust_inventory · wms.receive_inventory · wms.cycle_count · wms.import

## API routes

_none_

## DI service tokens

_none_

## Search entities

_none_

## Host extension points

- Entity IDs: _none_
- Table IDs: _none_

## Notifications

wms.inventory.low_stock · wms.inventory.reservation_shortfall

## CLI

verify-balances
