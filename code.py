import requests
 
url = "https://api.github.com/rate_limit"
headers = {"Authorization": "token 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"}
 
response = requests.get(url, headers=headers)
print(response.json())