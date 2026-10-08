import Link from "next/link";

export default function NotFound() {
  return <main className="not-found-page"><section><p className="eyebrow">404</p><h1>Página não encontrada.</h1><Link href="/">Voltar ao início</Link></section></main>;
}
