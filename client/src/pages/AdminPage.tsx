import Placeholder from "../components/Placeholder";

// Administrator Page (route /admin).
export default function AdminPage() {
  return (
    <Placeholder
      title="Administrator"
      requirements={[
        "FR-02: create, edit and delete centers (name, location, operating information, optional contact). A center with Available items cannot be deleted.",
        "FR-10: create staff accounts and assign each staff member to exactly one center; only administrators can change the assignment.",
        "FR-10: view all item records, correct them and change status when necessary.",
        "FR-10: item records are preserved even when their center is deleted.",
      ]}
    />
  );
}
