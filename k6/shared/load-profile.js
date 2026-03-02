export function dockerLoadOptions() {
  return {
    stages: [
      { duration: "1m", target: 1 },
      { duration: "2m", target: 10 },
      { duration: "2m", target: 15 },
      { duration: "3m", target: 25 },
      { duration: "3m", target: 50 },
      { duration: "3m", target: 50 },
      { duration: "2m", target: 15 },
      { duration: "1m", target: 1 },
      { duration: "1m", target: 0 },
    ],
    thresholds: {
      http_req_failed: ["rate<0.10"],
      http_req_duration: ["p(95)<3000"],
    },
  };
}
