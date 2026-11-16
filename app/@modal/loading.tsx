import { T } from "@/app/components/locale-provider";

export default function Loading() {
  return <div className="modal-loading" role="status" aria-busy="true"><T id="loading.prompt" /></div>;
}
