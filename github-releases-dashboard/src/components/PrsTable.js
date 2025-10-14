import React from "react";
import { Table, Badge } from "react-bootstrap";

const PrsTable = ({ items }) => {
  if (!items || items.length === 0) return <div className="text-center py-4">No PRs found</div>;

  return (
    <Table striped bordered hover responsive>
      <thead className="table-dark">
        <tr>
          <th>Title</th>
          <th>Repo</th>
          <th>Created At</th>
          <th>Status</th>
          <th>Link</th>
        </tr>
      </thead>
      <tbody>
        {items.map((p, idx) => (
          <tr key={`${p.repo_name}-${p.number || idx}`}>
            <td style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.title}>
              {p.title}
            </td>
            <td>
              {p.repo_owner && p.repo_name ? (
                <a href={`https://github.com/${p.repo_owner}/${p.repo_name}`} target="_blank" rel="noreferrer">
                  {p.repo_owner}/{p.repo_name}
                </a>
              ) : "-"}
            </td>
            <td>{p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
            <td>
              <Badge bg={p.state === "merged" ? "success" : p.state === "open" ? "primary" : "secondary"}>
                {p.state ? p.state.toUpperCase() : "UNKNOWN"}
              </Badge>
            </td>
            <td>
              <a href={p.html_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary">
                View PR
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default PrsTable;
