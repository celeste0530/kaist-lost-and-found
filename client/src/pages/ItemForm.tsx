import Placeholder from "../components/Placeholder";

// Register / Edit Item (route /staff/items/new and /staff/items/:id/edit).
export default function ItemForm() {
  return (
    <Placeholder
      title="Register / Edit Item"
      requirements={[
        "FR-03: name, category, found date (not in the future), found location chosen on the map, description, optional JPG/PNG image up to 10 MB.",
        "FR-03: the storage center is set automatically to the staff user's center and is not editable. New items start as Available.",
        "FR-04: only Available items stored at the user's center can be edited (administrators can edit any).",
        "3.1: error messages must explain missing or invalid inputs.",
      ]}
    />
  );
}
