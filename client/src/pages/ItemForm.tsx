import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import LocationPicker, { type LatLng } from "../components/LocationPicker";
import { CATEGORIES, type Center, type Item } from "../types";

// Must match the server (server/src/constants.ts, 3.1 / FR-03).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png"];

type Field = "name" | "category" | "foundDate" | "location" | "description" | "image";
type FieldErrors = Partial<Record<Field, string>>;

/** FR-03 "the found date cannot be in the future": today on campus (Korea), as the server checks it. */
function todayInKorea(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** The server answers 400 with "<field>: <reason>". Show it next to that field when we know the field. */
function serverErrorField(message: string): Field | null {
  const field = message.split(":")[0];
  if (field === "foundLat" || field === "foundLng") return "location";
  return (["name", "category", "foundDate", "description", "image"] as const).find((f) => f === field) ?? null;
}

// Register Item (FR-03, route /staff/items/new) and Edit Item (FR-04, route /staff/items/:id/edit).
export default function ItemForm() {
  const { id } = useParams();
  const isEdit = id !== undefined;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<Item | null>(null); // edit mode: the item as loaded
  const [center, setCenter] = useState<Center | null>(null); // register mode: the staff member's center
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(isEdit);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [foundDate, setFoundDate] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit mode: load the item and fill in the form.
  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api<Item>(`/items/${id}`)
      .then((it) => {
        setItem(it);
        setName(it.name);
        setCategory(it.category);
        setFoundDate(it.foundDate);
        setLocation({ lat: it.foundLat, lng: it.foundLng });
        setDescription(it.description);
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Register mode: show which center the item will be stored at (set by the server, not editable).
  useEffect(() => {
    if (isEdit || !user?.centerId) return;
    api<Center>(`/centers/${user.centerId}`)
      .then(setCenter)
      .catch(() => setCenter(null));
  }, [isEdit, user?.centerId]);

  // Preview of a newly chosen image. The object URL is released when it changes or the page closes.
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (!user) return null; // RequireAuth already redirects to the login page

  // Cases where the form must not be shown at all. The server rejects them too.
  if (!isEdit && user.centerId === null) {
    return (
      <section>
        <h1>Register Item</h1>
        <p className="error">Only staff assigned to a center can register items. Administrators cannot register items.</p>
      </section>
    );
  }
  if (loading) return <p>Loading…</p>;
  if (loadError) return <p className="error">{loadError}</p>;
  if (item && item.status !== "Available") {
    return (
      <section>
        <h1>Edit Item</h1>
        <p className="error">
          This item is {item.status}. Only Available items can be edited.
        </p>
        <Link to="/staff/inventory">Back to inventory</Link>
      </section>
    );
  }
  if (item && user.role !== "Administrator" && item.centerId !== user.centerId) {
    return (
      <section>
        <h1>Edit Item</h1>
        <p className="error">You can only edit items stored at your center.</p>
        <Link to="/staff/inventory">Back to inventory</Link>
      </section>
    );
  }

  const today = todayInKorea();

  /** Changing a field clears its error message; the whole form is checked again on submit. */
  const edited =
    <T,>(field: Field, set: (v: T) => void) =>
    (v: T) => {
      set(v);
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!name.trim()) e.name = "Enter the item name.";
    else if (name.trim().length > 255) e.name = "The name must be 255 characters or fewer.";
    if (!category) e.category = "Choose a category.";
    if (!foundDate) e.foundDate = "Enter the date the item was found.";
    else if (foundDate > today) e.foundDate = "The found date cannot be in the future.";
    if (!location) e.location = "Click on the map to mark where the item was found.";
    if (!description.trim()) e.description = "Enter a description.";
    return e;
  };

  /** Checks the chosen file like the server does (3.1). Returns false when the file was rejected. */
  const onImageChange = (file: File | null): boolean => {
    let problem: string | undefined;
    if (file && !IMAGE_TYPES.includes(file.type)) problem = "Only JPG or PNG images are allowed.";
    else if (file && file.size > MAX_IMAGE_BYTES) problem = "The image must be 10 MB or smaller.";
    setErrors((prev) => ({ ...prev, image: problem }));
    setImage(problem ? null : file);
    if (file && !problem) setRemoveImage(false);
    return !problem;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const found = validate();
    // Keep an image error from the file picker: the chosen file was rejected and not kept.
    if (errors.image) found.image = errors.image;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = new FormData();
    body.set("name", name.trim());
    body.set("category", category);
    body.set("foundDate", foundDate);
    body.set("foundLat", String(location!.lat));
    body.set("foundLng", String(location!.lng));
    body.set("description", description.trim());
    if (image) body.set("image", image);
    if (isEdit) body.set("removeImage", String(removeImage && !image));

    setSaving(true);
    try {
      const saved = await api<Item>(isEdit ? `/items/${id}` : "/items", { method: isEdit ? "PUT" : "POST", body });
      navigate(`/items/${saved.id}`);
    } catch (err) {
      const message = (err as Error).message;
      const field = serverErrorField(message);
      if (field) setErrors({ [field]: message.slice(message.indexOf(":") + 1).trim() });
      else setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (f: Field) => errors[f] && <span className="field-error">{errors[f]}</span>;
  const storageCenter = item ? item.centerName : center?.name;

  return (
    <section>
      <h1>{isEdit ? "Edit Item" : "Register Item"}</h1>
      <form className="item-form" onSubmit={onSubmit} noValidate>
        <p className="muted">
          Storage center: <strong>{storageCenter ?? "your assigned center"}</strong>
          {isEdit ? " (cannot be changed here)" : " (set automatically to your center)"}
        </p>

        <label>
          Item name *
          <input value={name} maxLength={255} onChange={(e) => edited("name", setName)(e.target.value)} aria-invalid={!!errors.name} />
          {fieldError("name")}
        </label>

        <label>
          Category *
          <select value={category} onChange={(e) => edited("category", setCategory)(e.target.value)} aria-invalid={!!errors.category}>
            <option value="">Choose a category</option>
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
            max={today}
            onChange={(e) => edited("foundDate", setFoundDate)(e.target.value)}
            aria-invalid={!!errors.foundDate}
          />
          {fieldError("foundDate")}
        </label>

        <div className="field">
          <span>Found location * (click on the map)</span>
          <LocationPicker value={location} onChange={edited("location", setLocation)} />
          {location && (
            <span className="muted">
              {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
          )}
          {fieldError("location")}
        </div>

        <label>
          Description *
          <textarea
            rows={4}
            value={description}
            onChange={(e) => edited("description", setDescription)(e.target.value)}
            aria-invalid={!!errors.description}
          />
          {fieldError("description")}
        </label>

        <div className="field">
          <span>Image (optional, JPG or PNG, up to 10 MB)</span>
          {preview ? (
            <img className="item-image" src={preview} alt="New image preview" />
          ) : (
            item?.imageUrl && !removeImage && <img className="item-image" src={`/uploads/${item.imageUrl}`} alt={item.name} />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={(e) => {
              // A rejected file is cleared from the picker so it is not mistaken for the chosen image.
              if (!onImageChange(e.target.files?.[0] ?? null)) e.target.value = "";
            }}
          />
          {item?.imageUrl && !image && (
            <label className="inline">
              <input type="checkbox" checked={removeImage} onChange={(e) => setRemoveImage(e.target.checked)} />
              Remove the current image
            </label>
          )}
          {fieldError("image")}
        </div>

        {formError && <p className="error">{formError}</p>}
        <div className="actions">
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Register item"}
          </button>
          <Link to={item ? `/items/${item.id}` : "/staff/inventory"}>Cancel</Link>
        </div>
      </form>
    </section>
  );
}
