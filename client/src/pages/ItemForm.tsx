import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import LocationPicker, { type LatLng } from "../components/LocationPicker";
import { CATEGORIES, type Category, type Center, type Item } from "../types";
import { imageProblem, todayInKorea } from "../util";

type Field = "name" | "category" | "foundDate" | "location" | "description";

// The server answers 400 with "<field>: <reason>" (server/src/utils.ts parseBody).
const SERVER_FIELDS: Record<string, Field | "image"> = {
  name: "name",
  category: "category",
  foundDate: "foundDate",
  foundLat: "location",
  foundLng: "location",
  description: "description",
  image: "image",
};

// FR-03 (register) and FR-04 (edit). Routes: /staff/items/new and /staff/items/:id/edit.
// The storage center is not an input: the server always uses the staff member's own center (FR-03).
export default function ItemForm() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [original, setOriginal] = useState<Item | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const [centerName, setCenterName] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [foundDate, setFoundDate] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [removeImage, setRemoveImage] = useState(false);

  // SRS 3.1: each problem is shown next to its field; `error` is for problems that belong to no field.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Wraps a setter so that changing a field clears its message (the form is checked again on submit). */
  const edited =
    <T,>(field: Field, set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };

  // Edit mode: load the current values.
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api<Item>(`/items/${id}`)
      .then((it) => {
        setOriginal(it);
        setName(it.name);
        setCategory(it.category);
        setFoundDate(it.foundDate);
        setLocation({ lat: it.foundLat, lng: it.foundLng });
        setDescription(it.description);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Read-only "storage center" line.
  const storageCenterId = isEdit ? original?.centerId : user?.centerId;
  useEffect(() => {
    if (storageCenterId == null) return;
    api<Center>(`/centers/${storageCenterId}`)
      .then((c) => setCenterName(c.name))
      .catch(() => setCenterName(isEdit ? (original?.centerName ?? "") : ""));
  }, [storageCenterId, isEdit, original?.centerName]);

  // Preview of the newly chosen image.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    setImageError("");
    if (chosen) {
      const problem = imageProblem(chosen);
      if (problem) {
        setImageError(problem);
        e.target.value = "";
        setFile(null);
        return;
      }
    }
    setFile(chosen);
  };

  if (loading) return <p>Loading…</p>;
  if (loadError) return <p className="error">{loadError}</p>;

  // Who may use this form (the server enforces the same rules).
  if (!isEdit && user?.centerId == null) {
    return (
      <section>
        <h1>Register Item</h1>
        <p className="error">
          Only staff members who are assigned to a center can register items. Administrators do not have an assigned
          center.
        </p>
      </section>
    );
  }
  if (isEdit && original) {
    if (user?.role !== "Administrator" && original.centerId !== user?.centerId) {
      return <p className="error">You can only edit items stored at your center.</p>;
    }
    if (original.status !== "Available") {
      return (
        <section>
          <h1>Edit Item</h1>
          <p className="error">Only Available items can be edited. This item is {original.status}.</p>
          <Link to="/staff/inventory">Back to inventory</Link>
        </section>
      );
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Same checks as the server, so the messages appear before anything is sent (SRS 3.1).
    // Every problem is reported at once, not only the first one.
    const problems: Partial<Record<Field, string>> = {};
    if (!name.trim()) problems.name = "Enter the item name.";
    if (!category) problems.category = "Choose a category.";
    if (!foundDate) problems.foundDate = "Enter the date the item was found.";
    else if (foundDate > todayInKorea()) problems.foundDate = "The found date cannot be in the future.";
    if (!location) problems.location = "Choose the place where the item was found on the map.";
    if (!description.trim()) problems.description = "Enter a description.";
    setFieldErrors(problems);
    // (!location / !category are already reported above; repeating them lets TypeScript narrow the types.)
    if (Object.keys(problems).length > 0 || !location || !category) return;

    const form = new FormData();
    form.append("name", name.trim());
    form.append("category", category);
    form.append("foundDate", foundDate);
    form.append("foundLat", String(location.lat));
    form.append("foundLng", String(location.lng));
    form.append("description", description.trim());
    if (file) form.append("image", file);
    else if (isEdit && removeImage) form.append("removeImage", "true");

    setSaving(true);
    try {
      const saved = await api<Item>(isEdit ? `/items/${id}` : "/items", {
        method: isEdit ? "PUT" : "POST",
        body: form,
      });
      navigate(`/items/${saved.id}`);
    } catch (err) {
      const message = (err as Error).message;
      const colon = message.indexOf(":");
      const field = colon > 0 ? SERVER_FIELDS[message.slice(0, colon)] : undefined;
      const reason = message.slice(colon + 1).trim();
      if (field === "image") setImageError(reason);
      else if (field) setFieldErrors({ [field]: reason });
      else setError(message);
      setSaving(false);
    }
  };

  const currentImage = isEdit && original?.imageUrl && !removeImage && !file ? original.imageUrl : null;
  const fieldError = (f: Field) => fieldErrors[f] && <span className="error field-error">{fieldErrors[f]}</span>;

  return (
    <section>
      <h1>{isEdit ? "Edit Item" : "Register Item"}</h1>
      <form className="form form-wide" onSubmit={onSubmit} noValidate>
        <label>
          Item name *
          <input
            value={name}
            onChange={(e) => edited("name", setName)(e.target.value)}
            maxLength={255}
            aria-invalid={!!fieldErrors.name}
          />
          {fieldError("name")}
        </label>

        <label>
          Category *
          <select
            value={category}
            onChange={(e) => edited("category", setCategory)(e.target.value as Category | "")}
            aria-invalid={!!fieldErrors.category}
          >
            <option value="">Choose…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {fieldError("category")}
        </label>

        <label>
          Found date *
          <input
            type="date"
            value={foundDate}
            max={todayInKorea()}
            onChange={(e) => edited("foundDate", setFoundDate)(e.target.value)}
            aria-invalid={!!fieldErrors.foundDate}
          />
          {fieldError("foundDate")}
        </label>

        <div>
          <div className="label-text">Found location * (click the map)</div>
          <LocationPicker value={location} onChange={edited("location", setLocation)} />
          {fieldError("location")}
        </div>

        <label>
          Description *
          <textarea
            value={description}
            onChange={(e) => edited("description", setDescription)(e.target.value)}
            rows={4}
            aria-invalid={!!fieldErrors.description}
          />
          {fieldError("description")}
        </label>

        <div>
          <label>
            Image (JPG or PNG, up to 10 MB) *
            <input type="file" accept="image/jpeg,image/png" onChange={onFileChange} />
          </label>
          {imageError && <p className="error">{imageError}</p>}
          {preview && <img className="item-image" src={preview} alt="New image preview" />}
          {currentImage && (
            <>
              <img className="item-image" src={`/uploads/${currentImage}`} alt="Current image" />
            </>
          )}
          {isEdit && original?.imageUrl && !file && (
            <label className="inline">
              <input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} />
              Remove the current image
            </label>
          )}
        </div>

        <div>
          <div className="label-text">Storage center</div>
          <div>{centerName || "Your assigned center"}</div>
          <div className="muted">Set automatically. It cannot be changed here.</div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Register item"}
          </button>
          <Link to="/staff/inventory">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
