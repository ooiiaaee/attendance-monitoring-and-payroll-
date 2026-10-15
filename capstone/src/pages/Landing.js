import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/shared.css";
import "./Landing.css";
import logoImg from "../assets/kajalogo.png";
import heroVideo from "../assets/video.mp4";

const PRACTICE_PROJECTS = [
  {
    title: "Strategy & Operations",
    location: "Logistics Network",
    description: "Redesigned the operating model for a 340-person logistics network across six regional hubs — cut decision latency from three weeks to four days.",
    size: "340 People",
    completion: "4 Days",
    client: "Global Hubs",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1200&q=75",
  },
  {
    title: "Financial Advisory",
    location: "$22M Acquisition",
    description: "Built the diligence model behind a $22M acquisition, then stayed through the first two quarters of integration.",
    size: "$22M",
    completion: "2 Quarters",
    client: "Private Equity",
    image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=75",
  },
  {
    title: "Organizational Design",
    location: "Engineering Org",
    description: "Rebuilt reporting lines for a 90-person engineering org after a leadership change, without a single unplanned departure.",
    size: "90 Staff",
    completion: "Zero Churn",
    client: "Tech Enterprise",
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=75",
  },
];

const SELECTED_WORK = [
  {
    tags: ["Strategy", "Operations"],
    title: "Logistics Network Redesign",
    detail: "340-person network across six regional hubs. Decision latency cut down from three weeks to four days with streamlined operational frameworks.",
    image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=75",
  },
  {
    tags: ["Advisory", "Finance"],
    title: "$22M Acquisition Integration",
    detail: "Built the diligence model behind a major $22M acquisition, maintaining continuity and staying through the first two quarters of post-merger integration.",
    image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=75",
  },
  {
    tags: ["Leadership", "Restructure"],
    title: "Post-Leadership Engineering Org",
    detail: "Successfully rebuilt reporting lines and team alignment for a 90-person engineering organization following structural changes—achieving zero unplanned departures.",
    image: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=75",
  },
  {
    tags: ["Expansion", "Scale"],
    title: "Regional Market Expansion Plan",
    detail: "Sequenced precise go-to-market execution across four new international territories inside an aggressive eighteen-month implementation timeline.",
    image: "https://images.unsplash.com/photo-1532622785990-d2c36a76f5a6?auto=format&fit=crop&w=800&q=75",
  },
  {
    tags: ["Turnaround", "Cashflow"],
    title: "Working Capital Optimization",
    detail: "Restructured payment terms across 40+ vital vendor contracts, freeing up $3.1M in structural liquid cash flow to fund key upcoming growth vectors.",
    image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=75",
  },
];

function WorkCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const maxIndex = SELECTED_WORK.length - 1;

  const next = () => setActiveIndex((s) => (s < maxIndex ? s + 1 : 0));
  const prev = () => setActiveIndex((s) => (s > 0 ? s - 1 : maxIndex));

  return (
    <div className="blueprint-carousel-container">
      {/* Left: heading, description and arrows */}
      <div className="blueprint-info-col">
        <div className="blueprint-text-content">
          <span className="pill-badge">Selected Work</span>
          <h2 className="blueprint-heading">Beyond the Blueprint</h2>
          <p className="blueprint-subtext">
            Exploring ideas, inspirations, and strategic innovations that shape the spaces and organizations we live and build in.
          </p>
        </div>

        <div className="blueprint-nav-arrows">
          <button
            className="blueprint-arrow-btn"
            onClick={prev}
            aria-label="Previous work"
          >
            ‹
          </button>
          <button
            className="blueprint-arrow-btn"
            onClick={next}
            aria-label="Next work"
          >
            ›
          </button>
        </div>
      </div>

      {/* Right: card carousel */}
      <div className="blueprint-stack-col">
        <div className="blueprint-stack-wrapper">
          {SELECTED_WORK.map((item, idx) => {
            let positionClass = "blueprint-card-hidden";
            
            if (idx === activeIndex) {
              positionClass = "blueprint-card-active";
            } else if (idx === activeIndex + 1 || (activeIndex === maxIndex && idx === 0)) {
              positionClass = "blueprint-card-next";
            } else if (idx === activeIndex + 2 || (activeIndex >= maxIndex - 1 && idx === (activeIndex + 2) % SELECTED_WORK.length)) {
              positionClass = "blueprint-card-far-next";
            }

            return (
              <div
                key={item.title}
                className={`blueprint-card ${positionClass}`}
                onClick={() => setActiveIndex(idx)}
              >
                <img src={item.image} alt={item.title} loading="lazy" />
                <div className="blueprint-card-overlay">
                  <div className="blueprint-tags-row">
                    {item.tags.map((tag, tIdx) => (
                      <span key={tIdx} className="blueprint-glass-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <h3 className="blueprint-card-title">{item.title}</h3>
                  <p className="blueprint-card-detail">{item.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PracticeShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeProj = PRACTICE_PROJECTS[activeIndex];

  return (
    <section className="landing-practice-section reveal" id="practice-areas">
      <div className="practice-header-container">
        <h2 className="practice-main-heading">What We Do</h2>
      </div>

      <div className="practice-interactive-grid">
        {/* Left: vertical list */}
        <div className="practice-list-col">
          <div className="vertical-indicator-line" />
          {PRACTICE_PROJECTS.map((item, idx) => (
            <div
              key={item.title}
              className={`practice-list-item ${activeIndex === idx ? "active" : ""}`}
              onClick={() => setActiveIndex(idx)}
            >
              <h3 className="practice-item-title">{item.title}</h3>
              <p className="practice-item-loc">{item.location}</p>
            </div>
          ))}
        </div>

        {/* Right: image preview card */}
        <div className="practice-preview-col">
          <div className="practice-image-card">
            <img src={activeProj.image} alt={activeProj.title} loading="lazy" />
            
            {/* Info box */}
            <div className="practice-glass-box">
              <h3 className="glass-title">{activeProj.title}</h3>
              <p className="glass-desc">{activeProj.description}</p>
              <span className="glass-link">EXPLORE DETAILS</span>
            </div>

            {/* Metrics bar */}
            <div className="practice-metrics-bar">
              <div className="metric-group">
                <span className="metric-label">Scale</span>
                <span className="metric-value">{activeProj.size}</span>
              </div>
              <div className="metric-group">
                <span className="metric-label">Timeline</span>
                <span className="metric-value">{activeProj.completion}</span>
              </div>
              <div className="metric-group">
                <span className="metric-label">Sector</span>
                <span className="metric-value">{activeProj.client}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const pageRef = useRef(null);

  useEffect(() => {
    const targets = pageRef.current?.querySelectorAll(".reveal") || [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page" ref={pageRef}>
      {/* Navigation bar */}
      <nav className="landing-nav-sticky">
  <div className="nav-left">
    <div className="brand-logo-group">
      <img src={logoImg} alt="KAJA Logo" className="nav-logo-img" />
      <span className="nav-brand-name">KAJA</span>
    </div>
  </div>

        <div className="nav-right">
          <div className="nav-capsule">
            <a href="#hero" className="nav-pill-link active">Home</a>
            <a href="#work" className="nav-pill-link">Selected</a>
            <a href="#practice-areas" className="nav-pill-link">What we do</a>
            <a href="#about" className="nav-pill-link">About</a>
            <a href="#contact" className="nav-pill-link">Contact Us</a>
          </div>

          <Link to={user ? "/dashboard" : "/login"} className="nav-login-btn-pill">
            {user ? "Go to dashboard" : "Log in"}
          </Link>
        </div>
      </nav>

      {/* Hero with video and about card */}
      <div className="hero-section-outer" id="hero">
        <video className="hero-video-bg" autoPlay loop muted playsInline>
          <source src={heroVideo} type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="hero-video-overlay" />

        {/* Hero title */}
        <div className="hero-title-container">
          <h1 className="hero-title-line">Change work</h1>
          <h1 className="hero-title-line">
            <span className="hero-pill-badge">
              <span className="pill-badge-inner" />
            </span>{" "}
            that shapes
          </h1>
          <h1 className="hero-title-line">
            tomorrow <span className="hero-hatch-pattern" />
          </h1>
        </div>

        {/* About card */}
        <div className="hero-bento-overlay-wrapper" id="about">
          <div className="about-bento-card">
            <div className="bento-box bento-intro">
              <span className="bento-badge">ABOUT KAJA</span>
              <h2 className="bento-main-title">Decisions that speak</h2>
              <p className="bento-description">
                Our work is rooted in the human experience, crafting organizational and operational strategies that drive lasting impact, foster clarity, and leave an enduring mark on tomorrow.
              </p>
            </div>

            <div className="bento-box bento-feature">
              <h3>Contemporary Visioning</h3>
              <p>Creating modern operational frameworks that feel clear, agile, and personal.</p>
            </div>

            <div className="bento-box bento-feature">
              <h3>Artistic Form Balance</h3>
              <p>Combining long-term strategic vision with meticulous detail to execute every move.</p>
            </div>

            <div className="bento-box bento-large-media">
              <img
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=75"
                alt="Customized architecture and design"
                loading="lazy"
              />
              <div className="media-overlay-content">
                <h3>Customized Design</h3>
                <p>Creating unique corporate structures that reflect your culture and goals.</p>
              </div>
            </div>

            <div className="bento-box bento-dark-media">
              <img
                src="https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=75"
                alt="Modern dark exterior design"
                loading="lazy"
              />
              <div className="dark-overlay-content">
                <h3>Elegant Living Design</h3>
                <p>Transforming complex decisions into seamless daily operational experiences.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    
      {/* What we do */}
      <PracticeShowcase />

      {/* Selected work */}
      <section className="landing-work-section reveal" id="work">
        <WorkCarousel />
      </section>

      {/* Contact banner */}
      <section className="landing-contact-section reveal" id="contact">
        <div className="vision-banner-card">
          <div className="vision-banner-content">
            <h2 className="vision-banner-title">Let’s Build Your Vision Together</h2>
            <p className="vision-banner-sub">
              From concept to creation, our team is ready to design spaces that inspire.
            </p>
            <a href="mailto:hello@kaja.example" className="vision-banner-btn">
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer-modern">
  <div className="footer-modern-grid">
    {/* Column 1: brand and contact */}
    <div className="footer-col-brand">
      <div className="footer-brand-logo-group">
        <img src={logoImg} alt="KAJA Logo" className="footer-logo-img" />
        <span className="footer-brand-title">KAJA</span>
      </div>
      <p className="footer-contact-info">+1 (7635) 547-12-97</p>
      <p className="footer-contact-info">support@kaja.example</p>
    </div>

          {/* Column 2: studio info */}
          <div className="footer-col-links">
            <h4 className="footer-col-head">Studio Info</h4>
            <div className="footer-links-subgrid">
              <a href="#about">About us</a>
              <a href="#contact">Team & Careers</a>
              <a href="#about">Our Philosophy</a>
              <a href="#contact">Contact</a>
            </div>
          </div>

          {/* Column 3: services */}
          <div className="footer-col-links">
            <h4 className="footer-col-head">Services</h4>
            <div className="footer-links-subgrid">
              <a href="#practice-areas">Architectural Design</a>
              <a href="#practice-areas">Urban Planning</a>
              <a href="#practice-areas">Interior Design</a>
              <a href="#practice-areas">Renovation & Restoration</a>
            </div>
          </div>
        </div>

        {/* Footer bottom bar */}
        <div className="footer-modern-bottom">
          <div className="footer-social-group">
            <a href="#social" className="social-icon-pill" aria-label="LinkedIn">in</a>
            <a href="#social" className="social-icon-pill" aria-label="Facebook">f</a>
            <a href="#social" className="social-icon-pill" aria-label="Twitter">𝕏</a>
          </div>
          <div className="footer-copyright">
            © {new Date().getFullYear()} KAJA. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}