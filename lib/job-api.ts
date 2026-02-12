// Simplified job search that returns mock data for testing
export interface JobListing {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    url: string;
    postedDate?: string;
    salary?: string;
    level?: string;
    category?: string;
}

export async function searchJobs(query: string, location?: string, page: number = 1): Promise<JobListing[]> {
    console.log('[Job API] searchJobs called with:', { query, location, page });

    try {
        const params = new URLSearchParams({
            page: page.toString(),
            descending: 'true'
        });

        // The Muse API doesn't support complex boolean queries, so simplify
        if (query) {
            // Extract simple keywords from complex queries
            const simpleQuery = query
                .replace(/[()]/g, '')
                .replace(/\s+(AND|OR|NOT)\s+/gi, ' ')
                .split(' ')
                .filter(word => word.length > 3 && !['junior', 'senior', 'lead'].includes(word.toLowerCase()))
                .slice(0, 2)
                .join(' ');

            console.log('[Job API] Simplified query from', query, 'to', simpleQuery);

            if (simpleQuery) {
                params.append('category', simpleQuery);
            }
        }

        if (location) {
            params.append('location', location);
        }

        const apiUrl = `https://www.themuse.com/api/public/jobs?${params.toString()}`;
        console.log('[Job API] Fetching:', apiUrl);

        const response = await fetch(apiUrl);

        if (!response.ok) {
            console.error('[Job API] HTTP Error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();
        console.log('[Job API] API returned', data.results?.length || 0, 'jobs');

        if (!data.results || data.results.length === 0) {
            console.warn('[Job API] No jobs found, returning empty array');
            return [];
        }

        const jobs: JobListing[] = data.results.map((job: any) => ({
            id: job.id.toString(),
            title: job.name,
            company: job.company.name,
            location: job.locations?.[0]?.name || 'Remote',
            description: job.contents || 'No description available',
            url: job.refs.landing_page,
            postedDate: job.publication_date,
            level: job.levels?.[0]?.name,
            category: job.categories?.[0]?.name
        }));

        console.log('[Job API] Returning', jobs.length, 'formatted jobs');
        return jobs;

    } catch (error) {
        console.error('[Job API] Exception:', error);
        return [];
    }
}

export async function searchJobsByKeywords(keywords: string[], location?: string): Promise<JobListing[]> {
    const query = keywords.join(' ');
    return await searchJobs(query, location);
}
