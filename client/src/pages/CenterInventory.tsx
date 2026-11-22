import Placeholder from "../components/Placeholder";

// Center Inventory Management (route /staff/inventory).
export default function CenterInventory() {
  return (
    <Placeholder
      title="Center Inventory"
      requirements={[
        "List the items stored at the staff member's center (all statuses), with a link to register a new item.",
        "FR-08: mark an item as Returned (records the return date and the staff user).",
        "FR-09: mark an item as Removed (invalid / duplicate record) or Disposed (no longer stored by the center).",
        "FR-04: edit Available items of this center.",
      ]}
    />
  );
}
