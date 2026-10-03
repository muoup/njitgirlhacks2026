/** Stand-in for routes the landing page links to before they exist. */
export function NotBuilt() {
  return (
    <main className="grid min-h-svh place-items-center bg-grove-sky px-6 text-center">
      <div>
        <h1 className="m-0 font-brush text-6xl font-normal text-grove-parchment">Nothing grows here yet.</h1>
        <p className="mt-4 text-grove-mist">This page hasn&rsquo;t been built.</p>
        <a href="/" className="mt-6 inline-block font-bold text-grove-ember-hi underline underline-offset-4">
          Back to the grove
        </a>
      </div>
    </main>
  );
}
