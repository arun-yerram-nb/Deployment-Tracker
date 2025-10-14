const API_BASE = "http://127.0.0.1:5000/api";
const PER_PAGE = 50;

export const fetchPRs = async (username, category, page = 1) => {
  const params = new URLSearchParams({ username, page, per_page: PER_PAGE });
  const url = `${API_BASE}/prs/${category}?${params.toString()}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch PRs");
  return data;
};
