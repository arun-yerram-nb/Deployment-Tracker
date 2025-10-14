import React, { useState } from "react";
import { Form, Button, InputGroup, Tab, Nav, Row, Col } from "react-bootstrap";
import TabPanel from "./TabPanel.js";

const categories = [
  { key: "created", label: "Created" },
  { key: "assigned", label: "Assigned" },
  { key: "review-requested", label: "Review Requested" },
  { key: "reviewed", label: "Reviewed" },
];

const UserPrsDashboard = () => {
  const [username, setUsername] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [activeKey, setActiveKey] = useState("created");

  const handleSearch = (e) => {
    e && e.preventDefault();
    setSearchUsername(username.trim());
  };

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4">GitHub PR Dashboard</h2>

      <Button
        variant="success"
        className="mb-3"
        onClick={() => window.open("/releases-dashboard", "_blank")}
      >
        Releases Dashboard
      </Button>

      <Form onSubmit={handleSearch} className="mb-3">
        <Row>
          <Col md={8}>
            <InputGroup>
              <Form.Control
                placeholder="Enter GitHub username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Button type="submit" variant="primary">Search</Button>
            </InputGroup>
          </Col>
        </Row>
      </Form>

      <Tab.Container activeKey={activeKey} onSelect={(k) => setActiveKey(k)}>
        <Nav variant="tabs">
          {categories.map(c => (
            <Nav.Item key={c.key}>
              <Nav.Link eventKey={c.key}>{c.label}</Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <Tab.Content className="mt-3">
          {categories.map(c => (
            <Tab.Pane eventKey={c.key} key={c.key}>
              <TabPanel category={c.key} username={searchUsername} />
            </Tab.Pane>
          ))}
        </Tab.Content>
      </Tab.Container>
    </div>
  );
};

export default UserPrsDashboard;

// import React, { useEffect, useState } from "react";
// import { Form, Button, InputGroup, Table, Tab, Nav, Row, Col, Spinner, Badge } from "react-bootstrap";

// const API_BASE = "http://127.0.0.1:5000/api";
// const PER_PAGE = 50;

// const categories = [
//   { key: "created", label: "Created" },
//   { key: "assigned", label: "Assigned" },
//   { key: "review-requested", label: "Review Requested" },
//   { key: "reviewed", label: "Reviewed" },
// ];

// const PrsTable = ({ items }) => {
//   if (!items || items.length === 0) return <div className="text-center py-4">No PRs found</div>;
//   return (
//     <Table striped bordered hover responsive>
//       <thead className="table-dark">
//         <tr>
//           <th>Title</th>
//           <th>Repo</th>
//           <th>Created At</th>
//           <th>Status</th>
//           <th>Link</th>
//         </tr>
//       </thead>
//       <tbody>
//         {items.map((p, idx) => (
//           <tr key={`${p.repo_name}-${p.number || idx}`}>
//             <td
//               style={{
//                 maxWidth: 360,
//                 overflow: "hidden",
//                 textOverflow: "ellipsis",
//                 whiteSpace: "nowrap",
//               }}
//               title={p.title}
//             >
//               {p.title}
//             </td>
//             <td>
//               {p.repo_owner && p.repo_name ? (
//                 <a
//                   href={`https://github.com/${p.repo_owner}/${p.repo_name}`}
//                   target="_blank"
//                   rel="noreferrer"
//                 >
//                   {p.repo_owner}/{p.repo_name}
//                 </a>
//               ) : (
//                 "-"
//               )}
//             </td>
//             <td>{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
//             <td>
//               <Badge
//                 bg={
//                   p.state === "merged"
//                     ? "success"
//                     : p.state === "open"
//                     ? "primary"
//                     : "secondary"
//                 }
//               >
//                 {p.state ? p.state.toUpperCase() : "UNKNOWN"}
//               </Badge>
//             </td>
//             <td>
//               <a
//                 href={p.html_url}
//                 target="_blank"
//                 rel="noreferrer"
//                 className="btn btn-sm btn-outline-primary"
//               >
//                 View PR
//               </a>
//             </td>
//           </tr>
//         ))}
//       </tbody>
//     </Table>
//   );
// };

// const TabPanel = ({ category, username }) => {
//   const [prs, setPrs] = useState([]);
//   const [page, setPage] = useState(1);
//   const [totalCount, setTotalCount] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [error, setError] = useState(null);

//   const fetchPage = async (pageNumber = 1, append = false) => {
//     if (!username) return;
//     try {
//       if (pageNumber === 1) setLoading(true);
//       else setLoadingMore(true);
//       setError(null);

//       const params = new URLSearchParams({ username, page: pageNumber, per_page: PER_PAGE });
//       const url = `${API_BASE}/prs/${category}?${params.toString()}`;
//       const res = await fetch(url);
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch");

//       const fetched = data.items || [];
//       setTotalCount(data.total_count || 0);
//       setPrs(prev => (append ? [...prev, ...fetched] : fetched));
//     } catch (err) {
//       setError(err.message || "Fetch error");
//     } finally {
//       setLoading(false);
//       setLoadingMore(false);
//     }
//   };

//   useEffect(() => {
//     setPrs([]);
//     setPage(1);
//     setTotalCount(0);
//     setError(null);
//     if (username) fetchPage(1, false);
//   }, [username, category]);

//   const loadMore = () => {
//     const next = page + 1;
//     fetchPage(next, true);
//     setPage(next);
//   };

//   const hasMore = prs.length < totalCount;

//   return (
//     <div>
//       {loading ? (
//         <div className="text-center py-4">
//           <Spinner animation="border" /> <div>Loading {category} PRs...</div>
//         </div>
//       ) : error ? (
//         <div className="alert alert-danger">{error}</div>
//       ) : (
//         <>
//           <PrsTable items={prs} />
//           {hasMore && (
//             <Row className="mt-2">
//               <Col className="text-center">
//                 <Button onClick={loadMore} disabled={loadingMore}>
//                   {loadingMore ? (
//                     <>
//                       <Spinner size="sm" animation="border" /> Loading...
//                     </>
//                   ) : (
//                     "Load More"
//                   )}
//                 </Button>
//               </Col>
//             </Row>
//           )}
//         </>
//       )}
//     </div>
//   );
// };

// const UserPrsDashboard = () => {
//   const [username, setUsername] = useState(""); // input value
//   const [searchUsername, setSearchUsername] = useState(""); // actual username for API
//   const [activeKey, setActiveKey] = useState("created");

//   const handleSearch = (e) => {
//     e && e.preventDefault();
//     setSearchUsername(username.trim()); // trigger API fetch
//   };

//   return (
//     <div className="container mt-4">
//       <h2 className="text-center mb-4">GitHub PR Dashboard</h2>

//       <Button
//         variant="success"
//         className="mb-3"
//         onClick={() => window.open("/releases-dashboard", "_blank")}
//       >
//         Releases Dashboard
//       </Button>

//       <Form onSubmit={handleSearch} className="mb-3">
//         <Row>
//           <Col md={8}>
//             <InputGroup>
//               <Form.Control
//                 placeholder="Enter GitHub username"
//                 value={username}
//                 onChange={(e) => setUsername(e.target.value)}
//               />
//               <Button type="submit" variant="primary">
//                 Search
//               </Button>
//             </InputGroup>
//           </Col>
//         </Row>
//       </Form>

//       <Tab.Container activeKey={activeKey} onSelect={(k) => setActiveKey(k)}>
//         <Nav variant="tabs">
//           {categories.map((c) => (
//             <Nav.Item key={c.key}>
//               <Nav.Link eventKey={c.key}>{c.label}</Nav.Link>
//             </Nav.Item>
//           ))}
//         </Nav>

//         <Tab.Content className="mt-3">
//           {categories.map((c) => (
//             <Tab.Pane eventKey={c.key} key={c.key}>
//               <TabPanel category={c.key} username={searchUsername} />
//             </Tab.Pane>
//           ))}
//         </Tab.Content>
//       </Tab.Container>
//     </div>
//   );
// };

// export default UserPrsDashboard;

// import React, { useEffect, useState } from "react";
// import { Form, Button, InputGroup, Table, Tab, Nav, Row, Col, Spinner, Badge } from "react-bootstrap";

// const API_BASE = "http://127.0.0.1:5000/api";
// const PER_PAGE = 50;

// const categories = [
//   { key: "created", label: "Created" },
//   { key: "assigned", label: "Assigned" },
//   { key: "review-requested", label: "Review Requested" },
//   { key: "reviewed", label: "Reviewed" },
// ];

// const PrsTable = ({ items }) => {
//   if (!items || items.length === 0) return <div className="text-center py-4">No PRs found</div>;
//   return (
//     <Table striped bordered hover responsive>
//       <thead className="table-dark">
//         <tr>
//           <th>Title</th>
//           <th>Repo</th>
//           <th>Created At</th>
//           <th>Status</th>
//           <th>Link</th>
//         </tr>
//       </thead>
//       <tbody>
//         {items.map((p, idx) => (
//           <tr key={`${p.repo_name}-${p.number || idx}`}>
//             <td style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.title}>
//               {p.title}
//             </td>
//             <td>
//               {p.repo_owner && p.repo_name ? (
//                 <a href={`https://github.com/${p.repo_owner}/${p.repo_name}`} target="_blank" rel="noreferrer">
//                   {p.repo_owner}/{p.repo_name}
//                 </a>
//               ) : "-"}
//             </td>
//             <td>{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
//             <td>
//               <Badge bg={p.state === "merged" ? "success" : p.state === "open" ? "primary" : "secondary"}>
//                 {p.state ? p.state.toUpperCase() : "UNKNOWN"}
//               </Badge>
//             </td>
//             <td>
//               <a href={p.html_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">View PR</a>
//             </td>
//           </tr>
//         ))}
//       </tbody>
//     </Table>
//   );
// };

// const TabPanel = ({ category, username }) => {
//   const [prs, setPrs] = useState([]);
//   const [page, setPage] = useState(1);
//   const [totalCount, setTotalCount] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [error, setError] = useState(null);

//   const fetchPage = async (pageNumber = 1, append = false) => {
//     if (!username) return;
//     try {
//       if (pageNumber === 1) setLoading(true);
//       else setLoadingMore(true);
//       setError(null);

//       const params = new URLSearchParams({ username, page: pageNumber, per_page: PER_PAGE });
//       const url = `${API_BASE}/prs/${category}?${params.toString()}`;
//       const res = await fetch(url);
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Failed to fetch");

//       const fetched = data.items || [];
//       setTotalCount(data.total_count || 0);
//       setPrs(prev => (append ? [...prev, ...fetched] : fetched));
//     } catch (err) {
//       setError(err.message || "Fetch error");
//     } finally {
//       setLoading(false);
//       setLoadingMore(false);
//     }
//   };

//   useEffect(() => {
//     setPrs([]); setPage(1); setTotalCount(0); setError(null);
//     if (username) fetchPage(1, false);
//   }, [username, category]);

//   const loadMore = () => {
//     const next = page + 1;
//     fetchPage(next, true);
//     setPage(next);
//   };

//   const hasMore = prs.length < totalCount;

//   return (
//     <div>
//       {loading ? (
//         <div className="text-center py-4"><Spinner animation="border" /> <div>Loading {category} PRs...</div></div>
//       ) : error ? (
//         <div className="alert alert-danger">{error}</div>
//       ) : (
//         <>
//           <PrsTable items={prs} />
//           {hasMore && (
//             <Row className="mt-2">
//               <Col className="text-center">
//                 <Button onClick={loadMore} disabled={loadingMore}>
//                   {loadingMore ? <><Spinner size="sm" animation="border" /> Loading...</> : "Load More"}
//                 </Button>
//               </Col>
//             </Row>
//           )}
//         </>
//       )}
//     </div>
//   );
// };

// const UserPrsDashboard = () => {
//   const [username, setUsername] = useState("");
//   const [activeKey, setActiveKey] = useState("created");

//   const handleSearch = (e) => { e && e.preventDefault(); };

//   return (
//     <div className="container mt-4">
//       <h2 className="text-center mb-4">GitHub PR Dashboard</h2>

//       <Button variant="success" className="mb-3" onClick={() => window.open("/releases-dashboard", "_blank")}>
//         Releases Dashboard
//       </Button>

//       <Form onSubmit={handleSearch} className="mb-3">
//         <Row>
//           <Col md={8}>
//             <InputGroup>
//               <Form.Control placeholder="Enter GitHub username" value={username} onChange={(e) => setUsername(e.target.value)} />
//               <Button type="submit" variant="primary">Search</Button>
//             </InputGroup>
//           </Col>
//         </Row>
//       </Form>

//       <Tab.Container activeKey={activeKey} onSelect={(k) => setActiveKey(k)}>
//         <Nav variant="tabs">
//           {categories.map(c => <Nav.Item key={c.key}><Nav.Link eventKey={c.key}>{c.label}</Nav.Link></Nav.Item>)}
//         </Nav>

//         <Tab.Content className="mt-3">
//           {categories.map(c => (
//             <Tab.Pane eventKey={c.key} key={c.key}>
//               <TabPanel category={c.key} username={username} />
//             </Tab.Pane>
//           ))}
//         </Tab.Content>
//       </Tab.Container>
//     </div>
//   );
// };

// export default UserPrsDashboard;

