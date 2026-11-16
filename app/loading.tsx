import { Brand } from "./components/brand";
import { T } from "./components/locale-provider";

export default function Loading() {
  return (
    <div className="supporting-page" aria-busy="true" role="status">
      <header className="supporting-header"><Brand /></header>
      <main className="loading-content">
        <span className="sr-only"><T id="loading.library" /></span>
        <div className="loading-intro" aria-hidden="true" />
        <div className="prompt-grid" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="loading-card"><span /><span /><span /></div>)}
        </div>
      </main>
    </div>
  );
}
