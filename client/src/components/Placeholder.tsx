/** Temporary screen for features that are specified in the SRS but not built yet. */
export default function Placeholder({ title, requirements }: { title: string; requirements: string[] }) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">Not implemented yet. Requirements from the SRS:</p>
      <ul>
        {requirements.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}
