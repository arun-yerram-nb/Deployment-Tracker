import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import UserPrsDashboard from "./components/UserPrsDashboard";
import UserReleasesDashboard from "./components/UserReleasesDashboard";
import axios from "axios";
import { Navbar, Nav, Container, Button, Badge } from "react-bootstrap";
import { useTheme } from "./ThemeContext";

// Use environment variable for sensitive data
const GITHUB_TOKEN = process.env.REACT_APP_GITHUB_TOKEN || "";

const App = () => {
  const { darkMode, toggleTheme } = useTheme();
  const [graphqlRemaining, setGraphqlRemaining] = useState(null);

  // Fetch GitHub GraphQL rate limit
  useEffect(() => {
    const fetchRateLimit = async () => {
      try {
        const res = await axios.get("https://api.github.com/rate_limit", {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`
          }
        });

        setGraphqlRemaining(res.data.resources.graphql.remaining);
      } catch (err) {
        console.error("Rate limit fetch error:", err);
      }
    };

    fetchRateLimit();
  }, []);

  return (
    <Router>
      <Navbar bg={darkMode ? "dark" : "light"} variant={darkMode ? "dark" : "light"} expand="lg">
        <Container>
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">PRs Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/releases">Releases Dashboard</Nav.Link>
          </Nav>

          {/* GraphQL Remaining Requests */}
          {graphqlRemaining !== null && (
            <span style={{ marginRight: "15px", color: darkMode ? "#ffffff" : "#000000" }}>
              GraphQL Remaining: <Badge bg={darkMode ? "secondary" : "info"}>{graphqlRemaining}</Badge>
            </span>
          )}

          <Button variant={darkMode ? "secondary" : "dark"} onClick={toggleTheme}>
            {darkMode ? "Light Mode" : "Dark Mode"}
          </Button>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <Routes>
          <Route path="/" element={<UserPrsDashboard />} />
          <Route path="/releases" element={<UserReleasesDashboard />} />
        </Routes>
      </Container>
    </Router>
  );
};

export default App;
