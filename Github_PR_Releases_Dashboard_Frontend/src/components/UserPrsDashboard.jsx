import React, { useEffect, useRef, useState } from "react";
import { Form, Row, Col, Table, Spinner, Pagination } from "react-bootstrap";

const API_BASE = "http://127.0.0.1:5000/api";

const UserPrsDashboard = () => {
  const [username, setUsername] = useState(localStorage.getItem("prs_username") || "");
  const [repoSearchTable, setRepoSearchTable] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [fromDate, setFromDate] = useState(localStorage.getItem("prs_fromDate") || "");
  const [toDate, setToDate] = useState(localStorage.getItem("prs_toDate") || "");

  const [allPrs, setAllPrs] = useState([]);
  const [filteredPrs, setFilteredPrs] = useState([]);
  const [displayedPrs, setDisplayedPrs] = useState([]);

  const [allUsers, setAllUsers] = useState([]);
  const [allRepos, setAllRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Dropdown refs
  const repoDropdownRef = useRef(null);
  const stateDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target)) setShowRepoDropdown(false);
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target)) setShowStateDropdown(false);
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) setShowUserDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load users and repos from local JSON
  useEffect(() => {
    fetch("/people.json").then((res) => res.json()).then(setAllUsers).catch(() => setAllUsers([]));
    fetch("/repos.json").then((res) => res.json()).then(setAllRepos).catch(() => setAllRepos([]));
  }, []);

  // -------------------- FETCH PRs AUTOMATICALLY ON MOUNT --------------------
  useEffect(() => {
    const fetchPRs = async () => {
      setLoading(true);
      try {
        let url = `${API_BASE}/user-prs`;
        const res = await fetch(url);
        const data = await res.json();
        const items = data.items || [];
        setAllPrs(items);
      } catch (err) {
        console.error(err);
        setAllPrs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPRs();
  }, []);

  // -------------------- AUTO FILTER --------------------
  useEffect(() => {
    let data = [...allPrs];

    // Filters applied automatically
    if (username.trim()) data = data.filter((pr) => (pr.author || "").toLowerCase().includes(username.trim().toLowerCase()));
    if (repoSearchTable.trim()) data = data.filter((pr) => (pr.repo_name || "").toLowerCase().includes(repoSearchTable.trim().toLowerCase()));
    if (stateSearch.trim()) data = data.filter((pr) => (pr.state || "").toLowerCase().includes(stateSearch.trim().toLowerCase()));
    if (fromDate) data = data.filter((pr) => new Date(pr.created_at) >= new Date(fromDate));
    if (toDate) data = data.filter((pr) => new Date(pr.created_at) <= new Date(toDate));

    // Sorting
    if (sortConfig.key) {
      data.sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        if (sortConfig.key === "created_at") {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        } else {
          valA = valA.toString().toLowerCase();
          valB = valB.toString().toLowerCase();
        }
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredPrs(data);
    setDisplayedPrs(data.slice(0, perPage));
    setPage(1);
  }, [allPrs, username, repoSearchTable, stateSearch, fromDate, toDate, sortConfig]);

  // -------------------- PAGINATION --------------------
  const handlePageChange = (pageNumber) => {
    setPage(pageNumber);
    const start = (pageNumber - 1) * perPage;
    setDisplayedPrs(filteredPrs.slice(start, start + perPage));
  };

  const totalPages = Math.max(1, Math.ceil(filteredPrs.length / perPage));
  const getPageNumbers = () => {
    const maxVisible = 7;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">GitHub Pull Request Dashboard</h2>
      <Form>
        <Row className="align-items-center mb-2">
          {/* Username */}
          <Col md={3} ref={userDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setShowUserDropdown(true)}
            />
            {showUserDropdown && (
              <div className="dropdown-menu show w-100" style={{ maxHeight: 150, overflowY: "auto" }}>
                {allUsers.filter((u) => u.toLowerCase().includes(username.toLowerCase()))
                  .map((u, idx) => (
                    <div key={idx} className="dropdown-item" onClick={() => { setUsername(u); setShowUserDropdown(false); }}>
                      {u}
                    </div>
                  ))}
              </div>
            )}
          </Col>

          {/* Repo */}
          <Col md={3} ref={repoDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Repo"
              value={repoSearchTable}
              onChange={(e) => { setRepoSearchTable(e.target.value); setShowRepoDropdown(true); }}
              onFocus={() => setShowRepoDropdown(true)}
            />
            {showRepoDropdown && (
              <div className="dropdown-menu show w-100" style={{ maxHeight: 150, overflowY: "auto" }}>
                {allRepos.filter((r) => r.toLowerCase().includes(repoSearchTable.toLowerCase()))
                  .map((r, idx) => (
                    <div key={idx} className="dropdown-item" onClick={() => { setRepoSearchTable(r); setShowRepoDropdown(false); }}>
                      {r}
                    </div>
                  ))}
              </div>
            )}
          </Col>

          {/* State */}
          <Col md={3} ref={stateDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by State"
              value={stateSearch}
              onChange={(e) => setStateSearch(e.target.value)}
              onFocus={() => setShowStateDropdown(true)}
            />
            {showStateDropdown && (
              <div className="dropdown-menu show w-100" style={{ maxHeight: 150, overflowY: "auto" }}>
                {Array.from(new Set(allPrs.map((p) => p.state)))
                  .filter((st) => st && st.toLowerCase().includes(stateSearch.toLowerCase()))
                  .map((st, idx) => (
                    <div key={idx} className="dropdown-item" onClick={() => { setStateSearch(st); setShowStateDropdown(false); }}>
                      {st}
                    </div>
                  ))}
              </div>
            )}
          </Col>
        </Row>

        <Row className="mb-3">
          <Col md={2}><Form.Control type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Col>
          <Col md={2}><Form.Control type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></Col>
        </Row>
      </Form>

      {loading ? (
        <div className="text-center py-4"><Spinner animation="border" /></div>
      ) : displayedPrs.length ? (
        <>
          <Table striped bordered hover responsive className="mt-3">
            <thead className="table-dark">
              <tr>
                <th onClick={() => handleSort("title")} style={{ cursor: "pointer" }}>Title</th>
                <th onClick={() => handleSort("repo_name")} style={{ cursor: "pointer" }}>Repo</th>
                <th onClick={() => handleSort("state")} style={{ cursor: "pointer" }}>State</th>
                <th onClick={() => handleSort("author")} style={{ cursor: "pointer" }}>Author</th>
                <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer" }}>Created At</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {displayedPrs.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td>{p.title}</td>
                  <td>{p.repo_name}</td>
                  <td>{p.state}</td>
                  <td>{p.author}</td>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td><a href={p.html_url} target="_blank" rel="noreferrer">view</a></td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination className="justify-content-center">
            <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
            <Pagination.Prev onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} />
            {getPageNumbers().map((p) => (
              <Pagination.Item key={p} active={p === page} onClick={() => handlePageChange(p)}>{p}</Pagination.Item>
            ))}
            <Pagination.Next onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} />
            <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={page === totalPages} />
          </Pagination>
        </>
      ) : (
        <div className="text-center py-4">No pull requests found</div>
      )}
    </div>
  );
};

export default UserPrsDashboard;

