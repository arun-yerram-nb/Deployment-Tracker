import React, { useEffect, useRef, useState } from "react";
import { Form, Button, Row, Col, Pagination, Table, Spinner } from "react-bootstrap";

const API_BASE = "http://127.0.0.1:5000/api";

const UserPrsDashboard = () => {
  const [username, setUsername] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoList, setRepoList] = useState([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(false);

  const userDropdownRef = useRef(null);
  const repoDropdownRef = useRef(null);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/people`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.people)) setAllUsers(data.people);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();
  }, []);

  // Fetch all repos
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await fetch(`${API_BASE}/repos`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.repos)) setRepoList(data.repos);
      } catch (err) {
        console.error("Failed to fetch repos:", err);
      }
    };
    fetchRepos();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) setShowUserDropdown(false);
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target)) setShowRepoDropdown(false);
    };
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, []);

  const filteredUsers = allUsers.filter(u => u.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const filteredRepos = repoList.filter(r => r.toLowerCase().includes(repoSearch.trim().toLowerCase()));

  const fetchPRs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (username) params.append("username", username);
      if (selectedRepo) params.append("repo", selectedRepo);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      params.append("page", pageNum);
      params.append("per_page", perPage);

      const res = await fetch(`${API_BASE}/prs/all?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setPrs(data.items || []);
        setTotalCount(data.total_count || 0);
        setPage(data.page || 1);
      } else {
        console.error("Error fetching PRs:", data.error);
        setPrs([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error("Failed to fetch PRs:", err);
      setPrs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    setPage(1);
    fetchPRs(1);
  };

  const handleSelectUser = (user) => { setUsername(user || ""); setUserSearch(user || ""); setShowUserDropdown(false); };
  const handleClearUser = () => { setUsername(""); setUserSearch(""); setShowUserDropdown(false); };
  const handleSelectRepo = (repo) => { setSelectedRepo(repo || ""); setRepoSearch(repo || ""); setShowRepoDropdown(false); };
  const handleClearRepo = () => { setSelectedRepo(""); setRepoSearch(""); setShowRepoDropdown(false); };

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  // --- Pagination range logic ---
  const getPageNumbers = () => {
    const maxVisible = 10;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    const pages = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">GitHub PR Dashboard</h2>

      {/* Search + date filter + releases button */}
      <Row className="align-items-center mb-3">
        <Col md={8}>
          <Form onSubmit={handleSearch}>
            <Row className="g-2">
              {/* Username */}
              <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
                <Form.Control
                  placeholder="Search GitHub username..."
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUsername(""); setShowUserDropdown(true); }}
                  onFocus={() => setShowUserDropdown(true)}
                />
                {showUserDropdown && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    maxHeight: 220, overflowY: "auto", background: "white",
                    border: "1px solid rgba(0,0,0,.15)", borderRadius: 4, zIndex: 1000
                  }}>
                    <div style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={handleClearUser}>
                      <strong>All Users</strong>
                    </div>
                    {filteredUsers.length === 0 ? (
                      <div style={{ padding: "8px 10px", color: "#666" }}>No matches</div>
                    ) : (
                      filteredUsers.map((u, idx) => (
                        <div key={u + "-" + idx} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={() => handleSelectUser(u)}>
                          {u}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Col>

              {/* Repo */}
              <Col md={3} ref={repoDropdownRef} style={{ position: "relative" }}>
                <Form.Control
                  placeholder="Select repo..."
                  value={repoSearch}
                  onChange={(e) => { setRepoSearch(e.target.value); setSelectedRepo(""); setShowRepoDropdown(true); }}
                  onFocus={() => setShowRepoDropdown(true)}
                />
                {showRepoDropdown && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0,
                    maxHeight: 220, overflowY: "auto", background: "white",
                    border: "1px solid rgba(0,0,0,.15)", borderRadius: 4, zIndex: 1000
                  }}>
                    <div style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={handleClearRepo}>
                      <strong>All Repos</strong>
                    </div>
                    {filteredRepos.length === 0 ? (
                      <div style={{ padding: "8px 10px", color: "#666" }}>No matches</div>
                    ) : (
                      filteredRepos.map((r, idx) => (
                        <div key={r + "-" + idx} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={() => handleSelectRepo(r)}>
                          {r}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Col>

              {/* From Date */}
              <Col md={2}>
                <Form.Control
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </Col>

              {/* To Date */}
              <Col md={2}>
                <Form.Control
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </Col>

              {/* Search Button */}
              <Col md={2}>
                <Button type="submit" variant="primary" className="w-100">Search</Button>
              </Col>
            </Row>
          </Form>
        </Col>

        {/* Releases Dashboard Button */}
        <Col md={4} className="text-end">
          <Button variant="success" onClick={() => window.open("/releases-dashboard", "_blank")}>
            Releases Dashboard
          </Button>
        </Col>
      </Row>

      {/* PR Table */}
      <div>
        {loading ? (
          <div className="text-center"><Spinner animation="border" /></div>
        ) : prs.length === 0 ? (
          <div className="text-center">No PRs found</div>
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Title</th>
                <th>Number</th>
                <th>Repo</th>
                <th>State</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {prs.map((pr) => (
                <tr key={pr.html_url}>
                  <td><a href={pr.html_url} target="_blank" rel="noreferrer">{pr.title}</a></td>
                  <td>{pr.number}</td>
                  <td>{pr.repo_name}</td>
                  <td>{pr.state}</td>
                  <td>{new Date(pr.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > perPage && (
        <Pagination className="mt-3">
          <Pagination.First onClick={() => fetchPRs(1)} disabled={page === 1} />
          <Pagination.Prev onClick={() => fetchPRs(Math.max(1, page - 1))} disabled={page === 1} />
          {getPageNumbers().map((p) => (
            <Pagination.Item key={p} active={page === p} onClick={() => fetchPRs(p)}>
              {p}
            </Pagination.Item>
          ))}
          <Pagination.Next onClick={() => fetchPRs(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
          <Pagination.Last onClick={() => fetchPRs(totalPages)} disabled={page === totalPages} />
        </Pagination>
      )}
    </div>
  );
};

export default UserPrsDashboard;

