import { Header } from "../components/landing_page/header";
import { Hero } from "../components/landing_page/hero";
import { Pricing } from "../components/landing_page/pricing";
import { Footer } from "../components/landing_page/footer";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1">
        <Hero />

        <div className="w-full h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />

        <Pricing />
      </main>

      <div className="w-full h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />

      <Footer />
    </div>
  );
}
