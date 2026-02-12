import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || '';
    const location = searchParams.get('location') || '';
    const page = searchParams.get('page') || '1';

    try {
        const params = new URLSearchParams({
            page: page,
            descending: 'true'
        });

        // Add search query if provided
        if (query) {
            params.append('category', query);
        }

        // Add location if provided
        if (location) {
            params.append('location', location);
        }

        const response = await fetch(`https://www.themuse.com/api/public/jobs?${params.toString()}`);

        if (!response.ok) {
            return NextResponse.json(
                { error: `API Error: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        const jobs = data.results.map((job: any) => ({
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

        return NextResponse.json({ jobs });

    } catch (error) {
        console.error('Job search error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch jobs' },
            { status: 500 }
        );
    }
}
