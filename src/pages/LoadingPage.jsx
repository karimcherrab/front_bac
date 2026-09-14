import React from 'react'
import Navbar from "../components/loading/Navbar";
import Hero from "../components/loading/Hero";
import Features from "../components/loading/Features";
import Subjects from "../components/loading/Subjects";
import Testimonials from "../components/loading/Testimonials";
import Pricing from "../components/loading/Pricing";
import CTA from "../components/loading/CTA";
import Footer from "../components/loading/Footer";
const LoadingPage = () => {
  return (
       <main dir="rtl" className="overflow-hidden">
      <Navbar />
      <Hero />
      <Features />
      <Subjects />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  )
}

export default LoadingPage