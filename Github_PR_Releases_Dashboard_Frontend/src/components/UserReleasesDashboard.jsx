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
import { useTheme } from "../ThemeContext";

const API_BASE = "http://127.0.0.1:5000/api";

const UserReleasesDashboard = () => {
  const { darkMode } = useTheme();

  const [username] = useState(localStorage.getItem("rel_username") || "");
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

  // Style objects for dark mode
  const formControlStyle = {
    backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
    color: darkMode ? "#ffffff" : "#000000",
    borderColor: darkMode ? "#444444" : "#dee2e6",
  };

  const dropdownStyle = {
    backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
    color: darkMode ? "#ffffff" : "#000000",
    maxHeight: 150,
    overflowY: "auto",
  };

  return (
    <div className="container mt-4" style={{ backgroundColor: darkMode ? "#121212" : "#ffffff" }}>
      <h2 className="text-center mb-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>GitHub Release Dashboard</h2>
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
              style={formControlStyle}
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
              style={formControlStyle}
            />
            {showRepoDropdown && (
              <div style={dropdownStyle}>
                {Array.from(new Set(allReleases.map((r) => r.repo_name)))
                  .filter((name) =>
                    name.toLowerCase().includes(repoSearchTable.toLowerCase())
                  )
                  .map((name, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      className="dropdown-item"
                      onClick={() => {
                        setRepoSearchTable(name);
                        setShowRepoDropdown(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setRepoSearchTable(name);
                          setShowRepoDropdown(false);
                        }
                      }}
                      style={{ ...dropdownStyle, cursor: "pointer" }}
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
              style={formControlStyle}
            />
            {showAuthorDropdown && (
              <div style={dropdownStyle}>
                {Array.from(new Set(allReleases.map((r) => r.author)))
                  .filter((name) =>
                    name.toLowerCase().includes(authorSearch.toLowerCase())
                  )
                  .map((name, idx) => (
                    <div
                      key={idx}
                      role="button"
                      tabIndex={0}
                      className="dropdown-item"
                      onClick={() => {
                        setAuthorSearch(name);
                        setShowAuthorDropdown(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setAuthorSearch(name);
                          setShowAuthorDropdown(false);
                        }
                      }}
                      style={{ ...dropdownStyle, cursor: "pointer" }}
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
              style={formControlStyle}
            />
          </Col>
          <Col md={2}>
            <Form.Control
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={formControlStyle}
            />
          </Col>
          <Col md="auto">
            <Button type="submit" style={{ backgroundColor: darkMode ? "#61dafb" : "#007bff", borderColor: darkMode ? "#61dafb" : "#007bff", color: darkMode ? "#000000" : "#ffffff" }}>Search</Button>
          </Col>
        </Row>


      </Form>

      {loading ? (
        <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>
          <Spinner animation="border" style={{ color: darkMode ? "#61dafb" : "#007bff" }} />
        </div>
      ) : displayedReleases.length ? (
        <>
          <Table 
            striped 
            bordered 
            hover 
            responsive 
            className={`mt-3 ${darkMode ? "table-dark" : "table-light"}`}
            style={{
              backgroundColor: darkMode ? "#1e1e1e" : "#ffffff",
              color: darkMode ? "#ffffff" : "#000000"
            }}
          >
            <thead className={darkMode ? "table-dark" : "table-light"} style={{ backgroundColor: darkMode ? "#121212" : "#f8f9fa" }}>
              <tr style={{ color: darkMode ? "#ffffff" : "#000000" }}>
                <th onClick={() => handleSort("name")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Name / Tag
                </th>
                <th onClick={() => handleSort("repo_name")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Repo
                </th>
                <th onClick={() => handleSort("author")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Author
                </th>
                <th onClick={() => handleSort("created_at")} style={{ cursor: "pointer", color: darkMode ? "#ffffff" : "#000000" }}>
                  Created At
                </th>
              
              </tr>
            </thead>
            <tbody>
  {displayedReleases.map((r) => (
    <tr key={r.id || r.tag_name} style={{ backgroundColor: darkMode ? "#1e1e1e" : "#ffffff", color: darkMode ? "#ffffff" : "#000000" }}>

      {/* 🔗 Title as hyperlink */}
      <td style={{ color: darkMode ? "#61dafb" : "#007bff" }}>
        <a href={r.html_url} target="_blank" rel="noreferrer" style={{ color: darkMode ? "#61dafb" : "#007bff", textDecoration: "none" }}>
          {r.name || r.tag_name}
        </a>
      </td>

      <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{r.repo_name}</td>
      <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{r.author}</td>
      <td style={{ color: darkMode ? "#ffffff" : "#000000" }}>{new Date(r.created_at).toLocaleString()}</td>

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
            {getPageNumbers().map((p) => {
              const isActive = p === page;
              const paginationBgColor = isActive ? (darkMode ? "#61dafb" : "#007bff") : "transparent";
              return (
                <Pagination.Item key={p} active={isActive} onClick={() => handlePageChange(p)} style={{ backgroundColor: paginationBgColor, color: darkMode ? "#ffffff" : "#000000" }}>
                  {p}
                </Pagination.Item>
              );
            })}
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
        <div className="text-center py-4" style={{ color: darkMode ? "#ffffff" : "#000000" }}>No releases found</div>
      )}
    </div>
  );
};

export default UserReleasesDashboard;