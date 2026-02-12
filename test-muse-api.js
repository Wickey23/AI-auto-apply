// Simple test script to verify The Muse API works
// Run with: node test-muse-api.js

async function testMuseAPI() {
    try {
        const url = 'https://www.themuse.com/api/public/jobs?page=1&descending=true';
        console.log('Testing The Muse API:', url);

        const response = await fetch(url);
        console.log('Status:', response.status, response.statusText);

        if (!response.ok) {
            console.error('API Error');
            return;
        }

        const data = await response.json();
        console.log('Results:', data.results?.length || 0, 'jobs');

        if (data.results && data.results.length > 0) {
            console.log('\nFirst job:');
            console.log('- Title:', data.results[0].name);
            console.log('- Company:', data.results[0].company.name);
            console.log('- URL:', data.results[0].refs.landing_page);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testMuseAPI();
