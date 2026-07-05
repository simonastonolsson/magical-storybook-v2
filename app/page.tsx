import Link from 'next/link';

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --ink: #1a1a2e;
          --cream: #faf8f3;
          --gold: #e8b84b;
          --gold-light: #fdf3d0;
          --purple: #7c3aed;
          --purple-light: #ede9fe;
          --pink: #f43f8e;
          --gray: #6b7280;
          --border: #e5e0d8;
        }
        html { scroll-behavior: smooth; }
        body { font-family: Inter, sans-serif; background: var(--cream); color: var(--ink); overflow-x: hidden; }
        .logo { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 900; color: var(--ink); letter-spacing: -0.02em; }
        .logo span { color: var(--purple); }
        nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 2.5rem; background: rgba(250,248,243,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
        nav a { text-decoration: none; color: var(--gray); font-size: 0.9rem; font-weight: 500; margin-left: 2rem; transition: color 0.2s; }
        nav a:hover { color: var(--ink); }
        .nav-cta { background: var(--purple); color: white !important; padding: 0.6rem 1.4rem; border-radius: 100px; }
        .hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8rem 2rem 4rem; position: relative; overflow: hidden; }
        .hero-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% 0%, #ede9fe 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 80% 80%, #fdf3d0 0%, transparent 60%); pointer-events: none; }
        .hero-badge { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--gold-light); border: 1px solid var(--gold); color: #92650a; font-size: 0.8rem; font-weight: 600; padding: 0.4rem 1rem; border-radius: 100px; margin-bottom: 2rem; letter-spacing: 0.04em; text-transform: uppercase; }
        .hero h1 { font-family: 'Playfair Display', serif; font-size: clamp(2.8rem, 7vw, 5.5rem); font-weight: 900; line-height: 1.08; letter-spacing: -0.03em; max-width: 900px; margin-bottom: 1.5rem; }
        .hero h1 em { font-style: normal; color: var(--purple); position: relative; }
        .hero h1 em::after { content: ''; position: absolute; bottom: 2px; left: 0; right: 0; height: 4px; background: var(--gold); border-radius: 2px; }
        .hero p { font-size: 1.2rem; color: var(--gray); max-width: 560px; line-height: 1.65; margin-bottom: 2.5rem; }
        .hero-actions { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: center; margin-bottom: 1.2rem; }
        .btn-primary { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--purple); color: white; font-size: 1.05rem; font-weight: 600; padding: 1rem 2.2rem; border-radius: 100px; text-decoration: none; transition: background 0.2s, transform 0.15s; box-shadow: 0 4px 24px rgba(124,58,237,0.25); }
        .btn-primary:hover { background: #6d28d9; transform: translateY(-2px); }
        .btn-secondary { display: inline-flex; align-items: center; gap: 0.5rem; color: var(--ink); font-size: 1rem; font-weight: 500; text-decoration: none; padding: 1rem 1.5rem; border-radius: 100px; border: 1.5px solid var(--border); transition: border-color 0.2s; }
        .btn-secondary:hover { border-color: var(--purple); background: var(--purple-light); }
        .hero-note { font-size: 0.85rem; color: var(--gray); }
        .book-strip { display: flex; gap: 1.5rem; justify-content: center; margin-top: 4rem; padding: 0 1rem; flex-wrap: wrap; }
        .book-card { background: white; border: 3px solid var(--ink); border-radius: 16px; overflow: hidden; box-shadow: 6px 6px 0 var(--ink); width: 200px; transition: transform 0.2s; }
        .book-card:hover { transform: translateY(-4px) rotate(-1deg); }
        .book-card-img { width: 100%; height: 140px; display: flex; align-items: center; justify-content: center; font-size: 3rem; background: linear-gradient(135deg, #ede9fe, #fdf3d0); }
        .book-card-label { padding: 0.75rem 1rem; font-size: 0.85rem; font-weight: 600; border-top: 2px solid var(--ink); background: var(--gold-light); }
        .stats { display: flex; gap: 3rem; justify-content: center; padding: 3rem 2rem; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .stat { text-align: center; }
        .stat-number { font-family: 'Playfair Display', serif; font-size: 2.5rem; font-weight: 900; color: var(--purple); line-height: 1; }
        .stat-label { font-size: 0.85rem; color: var(--gray); margin-top: 0.3rem; }
        .section { padding: 6rem 2rem; max-width: 1100px; margin: 0 auto; }
        .section-eyebrow { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--purple); margin-bottom: 1rem; }
        .section-title { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 1rem; max-width: 600px; }
        .section-sub { color: var(--gray); font-size: 1.05rem; max-width: 520px; line-height: 1.6; margin-bottom: 3.5rem; }
        .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
        .step { background: white; border: 1.5px solid var(--border); border-radius: 20px; padding: 2rem; transition: border-color 0.2s, box-shadow 0.2s; }
        .step:hover { border-color: var(--purple); box-shadow: 0 8px 32px rgba(124,58,237,0.1); }
        .step-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1.2rem; }
        .step-icon.purple { background: var(--purple-light); }
        .step-icon.gold { background: var(--gold-light); }
        .step-icon.pink { background: #fce7f3; }
        .step h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.6rem; }
        .step p { font-size: 0.92rem; color: var(--gray); line-height: 1.6; }
        .pricing-section { padding: 6rem 2rem; background: var(--ink); color: white; }
        .pricing-inner { max-width: 900px; margin: 0 auto; text-align: center; }
        .pricing-section .section-eyebrow { color: var(--gold); }
        .pricing-section .section-title { color: white; margin: 0 auto 1rem; }
        .pricing-section .section-sub { color: #9ca3af; margin: 0 auto 3rem; }
        .pricing-card { background: white; color: var(--ink); border-radius: 24px; padding: 3rem; max-width: 480px; margin: 0 auto; position: relative; overflow: hidden; }
        .pricing-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, var(--purple), var(--pink)); }
        .pricing-badge { display: inline-block; background: var(--gold-light); color: #92650a; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 0.3rem 0.8rem; border-radius: 100px; margin-bottom: 1.5rem; }
        .price { font-family: 'Playfair Display', serif; font-size: 4rem; font-weight: 900; line-height: 1; margin-bottom: 0.3rem; }
        .price span { font-size: 1.5rem; vertical-align: super; font-family: Inter, sans-serif; font-weight: 600; }
        .price-note { color: var(--gray); font-size: 0.9rem; margin-bottom: 2rem; }
        .features { list-style: none; text-align: left; margin-bottom: 2rem; }
        .features li { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0; font-size: 0.95rem; border-bottom: 1px solid var(--border); }
        .features li:last-child { border-bottom: none; }
        .features li::before { content: '✓'; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; background: var(--purple-light); color: var(--purple); border-radius: 50%; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
        .testimonials { padding: 6rem 2rem; max-width: 1100px; margin: 0 auto; }
        .testimonial-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 3rem; }
        .testimonial { background: white; border: 1.5px solid var(--border); border-radius: 20px; padding: 1.75rem; }
        .stars { color: var(--gold); font-size: 1rem; margin-bottom: 1rem; letter-spacing: 2px; }
        .testimonial p { font-size: 0.95rem; line-height: 1.65; color: var(--ink); margin-bottom: 1.2rem; }
        .testimonial-author { display: flex; align-items: center; gap: 0.75rem; }
        .avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0; }
        .author-name { font-size: 0.88rem; font-weight: 600; }
        .author-role { font-size: 0.8rem; color: var(--gray); }
        .faq-section { padding: 6rem 2rem; background: var(--purple-light); }
        .faq-inner { max-width: 700px; margin: 0 auto; }
        .faq-item { background: white; border-radius: 16px; padding: 1.5rem; margin-bottom: 1rem; border: 1.5px solid var(--border); }
        .faq-q { font-weight: 700; font-size: 1rem; margin-bottom: 0.6rem; }
        .faq-a { font-size: 0.92rem; color: var(--gray); line-height: 1.6; }
        .cta-banner { padding: 6rem 2rem; text-align: center; background: linear-gradient(135deg, var(--purple) 0%, #a855f7 50%, var(--pink) 100%); color: white; }
        .cta-banner h2 { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 900; margin-bottom: 1rem; letter-spacing: -0.02em; }
        .cta-banner p { font-size: 1.1rem; opacity: 0.85; margin-bottom: 2.5rem; max-width: 480px; margin-left: auto; margin-right: auto; }
        .btn-white { display: inline-flex; align-items: center; gap: 0.5rem; background: white; color: var(--purple); font-size: 1.05rem; font-weight: 700; padding: 1rem 2.5rem; border-radius: 100px; text-decoration: none; transition: transform 0.15s; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .btn-white:hover { transform: translateY(-2px); }
        footer { padding: 2.5rem; text-align: center; border-top: 1px solid var(--border); font-size: 0.85rem; color: var(--gray); }
      `}</style>

      <nav>
        <div className="logo">Story<span>labz</span></div>
        <div>
          <a href="#how">Hur det fungerar</a>
          <a href="#pris">Pris</a>
          <Link href="/skapa" className="nav-cta">Skapa din bok →</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg"></div>
        <div className="hero-badge">✨ AI-genererade personliga böcker</div>
        <h1>Din story.<br /><em>Ditt ansikte.</em><br />Din bok.</h1>
        <p>Ladda upp några foton – AI:n skapar en personlig seriebok med dig som stjärna. Perfekt present eller minnessak du aldrig glömmer.</p>
        <div className="hero-actions">
          <Link href="/skapa" className="btn-primary">Skapa din bok – 299 kr →</Link>
          <a href="#how" className="btn-secondary">Hur fungerar det?</a>
        </div>
        <div className="hero-note">30 sidor · Ladda ner som PDF · Inga prenumerationer</div>
        <div className="book-strip">
          <div className="book-card"><div className="book-card-img">🚀</div><div className="book-card-label">Månresan</div></div>
          <div className="book-card"><div className="book-card-img">🦁</div><div className="book-card-label">Safari-äventyret</div></div>
          <div className="book-card"><div className="book-card-img">🏔️</div><div className="book-card-label">Bergsklättringen</div></div>
          <div className="book-card"><div className="book-card-img">🐉</div><div className="book-card-label">Drakarnas dal</div></div>
        </div>
      </section>

      <div className="stats">
        <div className="stat"><div className="stat-number">30</div><div className="stat-label">Sidor per bok</div></div>
        <div className="stat"><div className="stat-number">~10 min</div><div className="stat-label">Från idé till färdig bok</div></div>
        <div className="stat"><div className="stat-number">299 kr</div><div className="stat-label">Fast pris, inga dolda avgifter</div></div>
        <div className="stat"><div className="stat-number">100%</div><div className="stat-label">Unik – skapad bara för dig</div></div>
      </div>

      <section className="section" id="how">
        <div className="section-eyebrow">Så här fungerar det</div>
        <div className="section-title">Tre steg till din personliga bok</div>
        <p className="section-sub">Inga tekniska kunskaper behövs. Du väljer äventyret – AI:n gör jobbet.</p>
        <div className="steps">
          <div className="step"><div className="step-icon purple">📸</div><h3>1. Ladda upp dina foton</h3><p>Välj 5–15 selfies eller bilder på den du vill sätta i boken. AI:n lär sig utseendet och skapar din unika karaktär.</p></div>
          <div className="step"><div className="step-icon gold">✍️</div><h3>2. Beskriv äventyret</h3><p>Skriv vad du vill att boken ska handla om. "En resa till månen", "En dag på safari" – din fantasi sätter gränsen.</p></div>
          <div className="step"><div className="step-icon pink">📖</div><h3>3. Ladda ner din bok</h3><p>AI:n genererar 30 sidor med bilder och berättelse där du är stjärnan. Ladda ner som PDF – redo att läsas eller tryckas.</p></div>
        </div>
      </section>

      <section className="pricing-section" id="pris">
        <div className="pricing-inner">
          <div className="section-eyebrow">Pris</div>
          <div className="section-title">En bok. Ett pris.</div>
          <p className="section-sub">Inga prenumerationer, inga överraskningar. Betala en gång, få din unika bok.</p>
          <div className="pricing-card">
            <div className="pricing-badge">Mest populär</div>
            <div className="price"><span>kr</span>299</div>
            <div className="price-note">per bok · engångsbetalning</div>
            <ul className="features">
              <li>30 sidor med AI-genererade bilder</li>
              <li>Du som huvudkaraktär i varje scen</li>
              <li>Valfritt äventyr och berättelse</li>
              <li>Lägg till kompis eller husdjur</li>
              <li>Ladda ner som PDF direkt</li>
              <li>Redigera text och rita om bilder</li>
            </ul>
            <Link href="/skapa" className="btn-primary" style={{width:'100%', justifyContent:'center'}}>Skapa din bok nu →</Link>
          </div>
        </div>
      </section>

      <section className="testimonials">
        <div className="section-eyebrow">Recensioner</div>
        <div className="section-title">Vad folk säger</div>
        <div className="testimonial-grid">
          <div className="testimonial"><div className="stars">★★★★★</div><p>"Gav detta som present till min son på hans födelsedag. Han blev helt tagen – att se sig själv som hjälten i en seriebok var magiskt."</p><div className="testimonial-author"><div className="avatar" style={{background:'#ede9fe'}}>👩</div><div><div className="author-name">Anna K.</div><div className="author-role">Mamma till en 8-åring</div></div></div></div>
          <div className="testimonial"><div className="stars">★★★★★</div><p>"Fantastisk bröllopspresent. Vi skapade en bok om vår Tinderresa – från första swipe till vigseln. Alla gäster ville se den."</p><div className="testimonial-author"><div className="avatar" style={{background:'#fdf3d0'}}>🧔</div><div><div className="author-name">Marcus L.</div><div className="author-role">Brudgum</div></div></div></div>
          <div className="testimonial"><div className="stars">★★★★★</div><p>"Tog ungefär 10 minuter att skapa och resultatet var häpnadsväckande. Likheterna var otroliga – det är verkligen jag i bilderna."</p><div className="testimonial-author"><div className="avatar" style={{background:'#fce7f3'}}>👱‍♀️</div><div><div className="author-name">Sara M.</div><div className="author-role">Designer</div></div></div></div>
        </div>
      </section>

      <section className="faq-section">
        <div className="faq-inner">
          <div className="section-eyebrow" style={{textAlign:'center'}}>Vanliga frågor</div>
          <div className="section-title" style={{textAlign:'center', margin:'0 auto 2.5rem'}}>Har du frågor?</div>
          <div className="faq-item"><div className="faq-q">Hur lika ser karaktären ut mig?</div><div className="faq-a">AI:n tränas på dina foton och lär sig ditt ansikte, hår och ansiktsdrag. Resultatet är imponerande likt – ju fler och varierade foton du laddar upp, desto bättre.</div></div>
          <div className="faq-item"><div className="faq-q">Hur lång tid tar det?</div><div className="faq-a">AI-träningen tar 5–10 minuter. Sedan genereras bilderna löpande medan du väntar – normalt är hela boken klar inom 15–20 minuter.</div></div>
          <div className="faq-item"><div className="faq-q">Kan jag lägga till barn eller husdjur?</div><div className="faq-a">Ja! Du kan lägga till en kompis, ett barn, en hund eller en katt som följeslagare i äventyret.</div></div>
          <div className="faq-item"><div className="faq-q">Vad händer med mina foton?</div><div className="faq-a">Dina foton används enbart för att träna AI-modellen och raderas sedan. Vi säljer eller delar aldrig din data med tredje part.</div></div>
          <div className="faq-item"><div className="faq-q">Kan jag beställa en tryckt bok?</div><div className="faq-a">Just nu levererar vi som PDF som du enkelt kan skriva ut hemma eller hos ett tryckeri. Tryckt bok-alternativ kommer snart.</div></div>
        </div>
      </section>

      <section className="cta-banner">
        <h2>Redo att bli en serietidningsstjärna?</h2>
        <p>Skapa din personliga bok på 10 minuter. 299 kr – ingen prenumeration.</p>
        <Link href="/skapa" className="btn-white">Kom igång nu →</Link>
      </section>

      <footer>
        <div className="logo">Story<span>labz</span></div>
        <p style={{marginTop:'0.5rem'}}>© 2026 Storylabz · Skapad med ❤️ och AI</p>
      </footer>
    </>
  );
}
