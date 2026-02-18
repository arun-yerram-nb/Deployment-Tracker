import React, { useEffect, useRef, useState } from "react";
import {
  Form,
  Button,
  Row,
  Col,
  Table,
  Spinner,
  Pagination,
} from "react-bootstrap";
import { useFetcher, useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:5000/api";

const UserReleasesDashboard = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState(localStorage.getItem("rel_username") || "");
  const [fromDate, setFromDate] = useState(localStorage.getItem("rel_fromDate") || "");
  const [toDate, setToDate] = useState(localStorage.getItem("rel_toDate") || "");

  const [tagSearch, setTagSearch] = useState("");
  const [repoSearchTable, setRepoSearchTable] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");

  const [allReleases, setAllReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [displayedReleases, setDisplayedReleases] = useState([]);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Refs for dropdown detection
  const repoDropdownRef = useRef(null);
  const authorDropdownRef = useRef(null);

  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target)) {
        setShowRepoDropdown(false);
      }
      if (authorDropdownRef.current && !authorDropdownRef.current.contains(event.target)) {
        setShowAuthorDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

    useEffect(() => {fetchReleases();},[])
  // -------------------- FETCH RELEASES --------------------
  const fetchReleases = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/user-releases?per_page=2000`;
      if (username.trim()) url += `&username=${encodeURIComponent(username.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      let items = data.items || [];

      // Filter by date locally
      if (fromDate || toDate) {
        items = items.filter((r) => {
          const created = new Date(r.created_at);
          let valid = true;
          if (fromDate) valid = valid && created >= new Date(fromDate);
          if (toDate) valid = valid && created <= new Date(toDate);
          return valid;
        });
      }

      setAllReleases(items);
    } catch (err) {
      console.error(err);
      setAllReleases([]);
    } finally {
      setLoading(false);
      setPage(1);
    }
  };

  // -------------------- FILTERING --------------------
  useEffect(() => {
  let data = [...allReleases];

  // Tag filter
  if (tagSearch.trim())
    data = data.filter(
      (r) =>
        (r.tag_name || "").toLowerCase().includes(tagSearch.trim().toLowerCase()) ||
        (r.name || "").toLowerCase().includes(tagSearch.trim().toLowerCase())
    );

  // Repo filter
  if (repoSearchTable.trim())
    data = data.filter((r) =>
      (r.repo_name || "").toLowerCase().includes(repoSearchTable.trim().toLowerCase())
    );

  // Author filter
  if (authorSearch.trim())
    data = data.filter((r) =>
      (r.author || "").toLowerCase().includes(authorSearch.trim().toLowerCase())
    );

  // **Date filter locally**
  if (fromDate)
    data = data.filter((r) => new Date(r.created_at) >= new Date(fromDate));
  if (toDate)
    data = data.filter((r) => new Date(r.created_at) <= new Date(toDate));

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

  setFilteredReleases(data);
  setDisplayedReleases(data.slice(0, perPage));
  setPage(1);
}, [allReleases, tagSearch, repoSearchTable, authorSearch, fromDate, toDate, sortConfig]);


  // -------------------- PAGINATION --------------------
  const handlePageChange = (pageNumber) => {
    setPage(pageNumber);
    const start = (pageNumber - 1) * perPage;
    setDisplayedReleases(filteredReleases.slice(start, start + perPage));
  };

  const totalPages = Math.max(1, Math.ceil(filteredReleases.length / perPage));
  const getPageNumbers = () => {
    const maxVisible = 7;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  // -------------------- SORTING --------------------
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">GitHub Release Dashboard</h2>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          fetchReleases();
        }}
      >
        <Row className="align-items-center">
           <Col md={2}>
            <Form.Control
              placeholder="Filter by Tag"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
            />
          </Col>
          {/* Repo autocomplete */}
          <Col md={2} ref={repoDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Repo"
              value={repoSearchTable}
              onChange={(e) => {
                setRepoSearchTable(e.target.value);
                setShowRepoDropdown(true);
              }}
              onFocus={() => setShowRepoDropdown(true)}
            />
            {showRepoDropdown && (
              <div
                className="dropdown-menu show w-100"
                style={{ maxHeight: 150, overflowY: "auto" }}
              >
                {Array.from(new Set(allReleases.map((r) => r.repo_name)))
                  .filter((name) =>
                    name.toLowerCase().includes(repoSearchTable.toLowerCase())
                  )
                  .map((name, idx) => (
                    <div
                      key={idx}
                      className="dropdown-item"
                      onClick={() => {
                        setRepoSearchTable(name);
                        setShowRepoDropdown(false);
                      }}
                    >
                      {name}
                    </div>
                  ))}
              </div>
            )}
          </Col>
          {/* Author autocomplete */}
          <Col md={2} ref={authorDropdownRef} style={{ position: "relative" }}>
            <Form.Control
              placeholder="Filter by Author"
              value={authorSearch}
              onChange={(e) => {
                setAuthorSearch(e.target.value);
                setShowAuthorDropdown(true);
              }}
              onFocus={() => setShowAuthorDropdown(true)}
            />
            {showAuthorDropdown && (
              <div
                className="dropdown-menu show w-100"
                style={{ maxHeight: 150, overflowY: "auto" }}
              >
                {Array.from(new Set(allReleases.map((r) => r.author)))
                  .filter((name) =>
                    name.toLowerCase().includes(authorSearch.toLowerCase())
                  )
                  .map((name, idx) => (
                    <div
                      key={idx}
                      className="dropdown-item"
                      onClick={() => {
                        setAuthorSearch(name);
                        setShowAuthorDropdown(false);
                      }}
                    >
                      {name}
                    </div>
                  ))}
              </div>
            )}
          </Col>
          <Col md={2}>
            <Form.Control
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </Col>
          <Col md={2}>
            <Form.Control
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </Col>
          <Col md="auto">
            <Button type="submit">Search</Button>
          </Col>
        </Row>


      </Form>

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : displayedReleases.length ? (
        <>
          <Table striped bordered hover responsive className="mt-3">
            <thead className="table-dark">
              <tr>
                <th onClick={() => handleSort("name")} style={{ cursor: "pointer" }}>
                  Name / Tag
                </th>
                <th onClick={() => handleSort("repo_name")} style={{ cursor: "pointer" }}>
                  Repo
                </th>
                <th onClick={() => handleSort("author")} style={{ cursor: "pointer" }}>
                  Author
                </th>
                <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer" }}>
                  Created At
                </th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {displayedReleases.map((r, idx) => (
                <tr key={r.id || idx}>
                  <td>{r.name || r.tag_name}</td>
                  <td>{r.repo_name}</td>
                  <td>{r.author}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    <a href={r.html_url} target="_blank" rel="noreferrer">
                      view
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Pagination className="justify-content-center">
            <Pagination.First onClick={() => handlePageChange(1)} disabled={page === 1} />
            <Pagination.Prev
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page === 1}
            />
            {getPageNumbers().map((p) => (
              <Pagination.Item key={p} active={p === page} onClick={() => handlePageChange(p)}>
                {p}
              </Pagination.Item>
            ))}
            <Pagination.Next
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            />
            <Pagination.Last
              onClick={() => handlePageChange(totalPages)}
              disabled={page === totalPages}
            />
          </Pagination>
        </>
      ) : (
        <div className="text-center py-4">No releases found</div>
      )}
    </div>
  );
};

export default UserReleasesDashboard;
