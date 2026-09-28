export const DEFAULT_CODE = `// Try the embedded SDK
async function main() {
  // Example: Initialize and get layout info
  const { layout } = await window.salla.embedded.init({ debug: true });
  console.log('Layout:', layout);

  // Get token from URL
  const token = window.salla.embedded.auth.getToken();
  console.log('Token:', token ? 'Found' : 'Not found');

  // Signal ready
  window.salla.embedded.ready();
  console.log('App ready!');
}

main();
`;
