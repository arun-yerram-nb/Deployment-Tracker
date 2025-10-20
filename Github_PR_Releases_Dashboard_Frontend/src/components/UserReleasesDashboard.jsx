import React, { useEffect, useRef, useState } from "react";
import { Form, Button, Row, Col, Table, Spinner, Pagination } from "react-bootstrap";

const API_BASE = "http://127.0.0.1:5000/api";

const UserReleasesDashboard = () => {
  const [username, setUsername] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoList, setRepoList] = useState([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);

  const [allReleases, setAllReleases] = useState([]);
  const [displayedReleases, setDisplayedReleases] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const repoDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  // Fetch all repos
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await fetch(`${API_BASE}/repos`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.repos)) setRepoList(data.repos || []);
      } catch (err) {
        console.error("Failed to fetch repos:", err);
      }
    };
    fetchRepos();
  }, []);

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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(e.target)) setShowRepoDropdown(false);
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) setShowUserDropdown(false);
    };
    document.addEventListener("click", handleClickOutside, true);
    return () => document.removeEventListener("click", handleClickOutside, true);
  }, []);

  const filteredRepos = repoList.filter((r) => r.toLowerCase().includes(repoSearch.trim().toLowerCase()));
  const filteredUsers = allUsers.filter((u) => u.toLowerCase().includes(userSearch.trim().toLowerCase()));

  // Fetch releases from backend
  const fetchReleases = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/user-releases?per_page=2000&`;
      if (username.trim()) url += `username=${encodeURIComponent(username.trim())}&`;
      if (selectedRepo) url += `repo=${encodeURIComponent(selectedRepo)}&`;

      const res = await fetch(url);
      const data = await res.json();
      let items = data.items || [];

      // Frontend-only date filter
      if (fromDate || toDate) {
        items = items.filter(r => {
          const created = new Date(r.created_at);
          let valid = true;
          if (fromDate) valid = valid && (created >= new Date(fromDate));
          if (toDate) valid = valid && (created <= new Date(toDate));
          return valid;
        });
      }

      // Sort by created_at descending
      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setAllReleases(items);
      setPage(1);
      setDisplayedReleases(items.slice(0, perPage));
    } catch (err) {
      console.error(err);
      setAllReleases([]);
      setDisplayedReleases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchReleases();
  };

  const handlePageChange = (pageNumber) => {
    setPage(pageNumber);
    const start = (pageNumber - 1) * perPage;
    setDisplayedReleases(allReleases.slice(start, start + perPage));
  };

  const handleSelectRepo = (repo) => {
    setSelectedRepo(repo || "");
    setRepoSearch(repo || "");
    setShowRepoDropdown(false);
    setPage(1);
    setDisplayedReleases([]);
  };
  const handleClearRepo = () => {
    setSelectedRepo("");
    setRepoSearch("");
    setShowRepoDropdown(false);
    setPage(1);
    setDisplayedReleases([]);
  };

  const handleSelectUser = (user) => {
    setUsername(user || "");
    setUserSearch(user || "");
    setShowUserDropdown(false);
    setPage(1);
    setDisplayedReleases([]);
  };
  const handleClearUser = () => {
    setUsername("");
    setUserSearch("");
    setShowUserDropdown(false);
    setPage(1);
    setDisplayedReleases([]);
  };

  const totalPages = Math.max(1, Math.ceil(allReleases.length / perPage));
  const paginationItems = [];
  const startPage = Math.max(1, page - 3);
  const endPage = Math.min(totalPages, page + 3);
  for (let number = startPage; number <= endPage; number++) {
    paginationItems.push(
      <Pagination.Item key={number} active={number === page} onClick={() => handlePageChange(number)}>
        {number}
      </Pagination.Item>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">GitHub Release Dashboard</h2>

      <Form onSubmit={handleSearch} className="mb-3">
        <Row className="align-items-center">
          {/* Username */}
          <Col md={3} className="mb-2" ref={userDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Search GitHub username..."
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setUsername(""); setShowUserDropdown(true); }}
              onFocus={() => setShowUserDropdown(true)}
            />
            {showUserDropdown && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 220, overflowY: "auto", background: "white", border: "1px solid rgba(0,0,0,.15)", borderRadius: 4, zIndex: 1000 }}>
                <div style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={handleClearUser}><strong>All Users</strong></div>
                {filteredUsers.length === 0 ? (<div style={{ padding: "8px 10px", color: "#666" }}>No matches</div>) : filteredUsers.map((u, idx) => (
                  <div key={u + "-" + idx} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={() => handleSelectUser(u)}>{u}</div>
                ))}
              </div>
            )}
          </Col>

          {/* Repo */}
          <Col md={3} className="mb-2" ref={repoDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Search or select repo..."
              value={repoSearch}
              onChange={(e) => { setRepoSearch(e.target.value); setSelectedRepo(""); setShowRepoDropdown(true); }}
              onFocus={() => setShowRepoDropdown(true)}
            />
            {showRepoDropdown && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 220, overflowY: "auto", background: "white", border: "1px solid rgba(0,0,0,.15)", borderRadius: 4, zIndex: 1000 }}>
                <div style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={handleClearRepo}><strong>All Repos</strong></div>
                {filteredRepos.length === 0 ? (<div style={{ padding: "8px 10px", color: "#666" }}>No matches</div>) : filteredRepos.map((r, idx) => (
                  <div key={r + "-" + idx} style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid rgba(0,0,0,.03)" }} onClick={() => handleSelectRepo(r)}>{r}</div>
                ))}
              </div>
            )}
          </Col>

          {/* From Date */}
          <Col md={2} className="mb-2">
            <Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="From Date" />
          </Col>

          {/* To Date */}
          <Col md={2} className="mb-2">
            <Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="To Date" />
          </Col>

          <Col md="auto" className="mb-2"><Button type="submit">Search</Button></Col>
        </Row>
      </Form>

      {loading ? (
        <div className="text-center py-4"><Spinner animation="border" /></div>
      ) : displayedReleases.length > 0 ? (
        <>
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr><th>Name / Tag</th><th>Repo</th><th>Created At</th><th>Link</th></tr>
            </thead>
            <tbody>
              {displayedReleases.map((r, idx) => (
                <tr key={`${r.repo_name}-${r.tag_name}-${idx}`}>
                  <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.tag_name}</td>
                  <td>{r.repo_name}</td>
                  <td>{r.created_at ? new Date(r.created_at).toLocaleString() : "-"}</td>
                  <td><a href={r.html_url} target="_blank" rel="noreferrer">View</a></td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="d-flex justify-content-center">
            <Pagination>
              <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
              <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
              {startPage > 1 && <Pagination.Ellipsis disabled />}
              {paginationItems}
              {endPage < totalPages && <Pagination.Ellipsis disabled />}
              <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
              <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
            </Pagination>
          </div>

          <div className="text-center mt-2" style={{ fontSize: 13, color: "#666" }}>
            Showing page {page} of {totalPages} — {allReleases.length} releases
          </div>
        </>
      ) : (
        <div className="text-center py-4">No releases found</div>
      )}
    </div>
  );
};

export default UserReleasesDashboard;
