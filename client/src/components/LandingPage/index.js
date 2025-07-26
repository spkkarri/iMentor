import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./index.css"; // Import the CSS

const LandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="landing-wrapper">
      <h1 className="gemlama-logo">TutorAI</h1>
    </div>
  );
};

export default LandingPage;
