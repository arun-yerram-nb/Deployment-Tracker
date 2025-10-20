import React, { useEffect, useState, useRef } from "react";
import { Form, Button, Row, Col, Table, Spinner, Pagination } from "react-bootstrap";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5000/api";

const ReleaseTagsDashboard = ({ tags }) => {
  const [tagSearch, setTagSearch] = useState(localStorage.getItem("tagSearch") || "");
  const [selectedTag, setSelectedTag] = useState(localStorage.getItem("selectedTag") || "");
  const [repos, setRepos] = useState(JSON.parse(localStorage.getItem("repos")) || []);
  const [displayedRepos, setDisplayedRepos] = useState(JSON.parse(localStorage.getItem("displayedRepos")) || []);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(Number(localStorage.getItem("tag_page")) || 1);
  const perPage = 10;

  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  // Restore displayed repos when tab loads
  useEffect(() => {
    if (repos.length > 0) {
      const start = (page - 1) * perPage;
      setDisplayedRepos(repos.slice(start, start + perPage));
    }
  }, []);
  const fetchReposByTag = async (tag) => {
    if (!tag) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/repos-by-tag`, { params: { tag } });
      const allRepos = res.data.repos || [];
      setRepos(allRepos);
      setPage(1);
      setDisplayedRepos(allRepos.slice(0, perPage));

      // Persist to localStorage
      localStorage.setItem("selectedTag", tag);
      localStorage.setItem("tagSearch", tag);
      localStorage.setItem("repos", JSON.stringify(allRepos));
      localStorage.setItem("displayedRepos", JSON.stringify(allRepos.slice(0, perPage)));
      localStorage.setItem("tag_page", 1);
    } catch (err) {
      console.error("Error fetching repos by tag:", err);
      setRepos([]);
      setDisplayedRepos([]);
      localStorage.removeItem("repos");
      localStorage.removeItem("displayedRepos");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (tagSearch.trim()) {
      setSelectedTag(tagSearch.trim());
      fetchReposByTag(tagSearch.trim());
    } else {
      setSelectedTag("");
      setRepos([]);
      setDisplayedRepos([]);
      localStorage.removeItem("selectedTag");
      localStorage.removeItem("tagSearch");
      localStorage.removeItem("repos");
      localStorage.removeItem("displayedRepos");
    }
    setShowSuggestions(false);
  };

  const handlePageChange = (pageNumber) => {
    setPage(pageNumber);
    const start = (pageNumber - 1) * perPage;
    setDisplayedRepos(repos.slice(start, start + perPage));
    localStorage.setItem("tag_page", pageNumber);
    localStorage.setItem("displayedRepos", JSON.stringify(repos.slice(start, start + perPage)));
  };

  const totalPages = Math.max(1, Math.ceil(repos.length / perPage));
  const getPageNumbers = () => {
    const maxVisible = 7;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const filteredSuggestions = tags
    .filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()))
    .slice(0, 10);

  const handleSelectSuggestion = (tag) => {
    setTagSearch(tag);
    setShowSuggestions(false);
    // Fetch will occur only on Search button click
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">Release Tags Dashboard</h2>

      <Form onSubmit={handleSearch} className="mb-3">
        <Row className="align-items-center" style={{ position: "relative" }}>
          <Col md={6} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Search for a release tag..."
              value={tagSearch}
              ref={inputRef}
              onChange={(e) => { setTagSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                maxHeight: 200, overflowY: "auto",
                background: "white", border: "1px solid rgba(0,0,0,.15)",
                borderRadius: 4, zIndex: 1000
              }}>
                {filteredSuggestions.map((tag, idx) => (
                  <div
                    key={tag + "-" + idx}
                    style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }}
                    onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(tag); }}
                  >
                    {tag}
                  </div>
                ))}
              </div>
            )}
          </Col>
          <Col md="auto">
            <Button type="submit">Search</Button>
          </Col>
        </Row>
      </Form>

      {loading ? (
        <div className="text-center py-4"><Spinner animation="border" /></div>
      ) : displayedRepos.length > 0 ? (
        <>
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr><th>Repo Name</th><th>Tag</th></tr>
            </thead>
            <tbody>
              {displayedRepos.map((r, idx) => (
                <tr key={`${r.repo_name}-${idx}`}>
                  <td>{r.repo_name}</td>
                  <td>{r.tag_name}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="d-flex justify-content-center">
            <Pagination>
              <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
              <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
              {getPageNumbers()[0] > 1 && <Pagination.Ellipsis disabled />}
              {getPageNumbers().map((p) => (
                <Pagination.Item key={p} active={p === page} onClick={() => handlePageChange(p)}>{p}</Pagination.Item>
              ))}
              {getPageNumbers().slice(-1)[0] < totalPages && <Pagination.Ellipsis disabled />}
              <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
              <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
            </Pagination>
          </div>

          <div className="text-center mt-2" style={{ fontSize: 13, color: "#666" }}>
            Showing page {page} of {totalPages} — {repos.length} repos
          </div>
        </>
      ) : selectedTag ? (
        <div className="text-center py-4">No repositories found for this tag</div>
      ) : null}
    </div>
  );
};

export default ReleaseTagsDashboard;

