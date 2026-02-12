"use client";

import { useEffect, useState } from "react";
import { generateJobSearchQueriesAction, getJobSearchPersonalizationStatusAction, searchJobsAction } from "@/app/actions";
import { JobSearchResults } from "@/components/JobSearchResults";
import { Search, Loader2, ExternalLink, Briefcase, Sliders, AlertCircle, Sparkles } from "lucide-react";

export default function FindJobsPage() {
    const formatQueryForDisplay = (query: string) => {
        const cleaned = (query || "")
            .replace(/[()]/g, "")
            .replace(/\s+/g, " ")
            .trim();

        const parts = cleaned
            .split(/\s+AND\s+/i)
            .map((part) => part.replace(/\s+OR\s+/gi, " / ").trim())
            .filter(Boolean);

        return parts;
    };
    const LOCATION_OPTIONS = [
        "United States",
        "Remote",
        "New York, NY",
        "San Francisco, CA",
        "Los Angeles, CA",
        "Seattle, WA",
        "Austin, TX",
        "Boston, MA",
        "Chicago, IL",
        "Miami, FL",
    ];
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoadingPersonalization, setIsLoadingPersonalization] = useState(true);
    const [personalizationStatus, setPersonalizationStatus] = useState<{
        resume: { ready: boolean; detail: string };
        profile: { ready: boolean; detail: string };
        linkedin: { ready: boolean; detail: string };
    } | null>(null);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [jobsByQuery, setJobsByQuery] = useState<Record<number, any[]>>({});
    const [loadingQuery, setLoadingQuery] = useState<number | null>(null);
    const [selectedLocationOption, setSelectedLocationOption] = useState("United States");
    const [keywordInput, setKeywordInput] = useState("");
    const [filters, setFilters] = useState({
        locations: [] as string[],
        keywords: [] as string[],
        usOnly: true,
        remoteOnly: false,
        relocation: "any" as "any" | "yes" | "no",
        level: "",
        minRelevance: 1,
        postedWithinDays: 30,
    });

    useEffect(() => {
        const loadStatus = async () => {
            setIsLoadingPersonalization(true);
            try {
                const status = await getJobSearchPersonalizationStatusAction();
                setPersonalizationStatus(status);
            } catch {
                setPersonalizationStatus(null);
            } finally {
                setIsLoadingPersonalization(false);
            }
        };
        loadStatus();
    }, []);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        try {
            const data = await generateJobSearchQueriesAction();
            setResults(data);
            setJobsByQuery({});
            if (data.defaultFilters) {
                const defaultLocation = (data.defaultFilters.location || "").trim();
                setFilters({
                    locations: defaultLocation ? [defaultLocation] : [],
                    keywords: [],
                    usOnly: data.defaultFilters.usOnly !== false,
                    remoteOnly: Boolean(data.defaultFilters.remoteOnly),
                    relocation: data.defaultFilters.relocation || "any",
                    level: data.defaultFilters.level || "",
                    minRelevance: Number(data.defaultFilters.minRelevance || 1),
                    postedWithinDays: Number(data.defaultFilters.postedWithinDays || 30),
                });
                if (defaultLocation) setSelectedLocationOption(defaultLocation);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSearchJobs = async (query: string, queryIndex: number) => {
        console.log('[Find Jobs] Searching for:', query, 'Index:', queryIndex);
        setLoadingQuery(queryIndex);
        setError(null);
        try {
            const primaryLocation = filters.locations[0] || "";
            const jobResults = await searchJobsAction(query, primaryLocation, {
                ...filters,
                location: primaryLocation,
            });
            console.log('[Find Jobs] Results:', jobResults);
            setJobsByQuery(prev => ({ ...prev, [queryIndex]: jobResults }));
        } catch (e) {
            console.error('[Find Jobs] Error:', e);
            setError((e as Error).message);
        } finally {
            setLoadingQuery(null);
        }
    };

    const getSearchLink = (site: string, query: string) => {
        const locationText = filters.locations.length ? filters.locations.join(" OR ") : "";
        const keywordsText = filters.keywords.length ? filters.keywords.join(" ") : "";
        const withLocation = [query, keywordsText, locationText].filter(Boolean).join(" ");
        const encoded = encodeURIComponent(withLocation);
        switch (site) {
            case 'linkedin': return `https://www.linkedin.com/jobs/search/?keywords=${encoded}`;
            case 'indeed': return `https://www.indeed.com/jobs?q=${encoded}`;
            case 'glassdoor': return `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encoded}`;
            case 'google': return `https://www.google.com/search?q=${encoded}&ibp=htl;jobs`;
            case 'company': return `https://www.google.com/search?q=${encoded}+site%3Agreenhouse.io+OR+site%3Alever.co+OR+%22careers%22`;
            default: return "#";
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Job Search Assistant</h1>
                <p className="text-muted-foreground">AI-powered search strategies and real job listings.</p>
            </div>

            <div className="bg-white p-4 rounded-xl border shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-3">Personalization Sources</h3>
                {isLoadingPersonalization ? (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 size={14} className="animate-spin" />
                        Checking connected data sources...
                    </div>
                ) : personalizationStatus ? (
                    <div className="grid gap-2 md:grid-cols-3">
                        {[
                            { label: "Resume", data: personalizationStatus.resume },
                            { label: "Profile", data: personalizationStatus.profile },
                            { label: "LinkedIn", data: personalizationStatus.linkedin },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className={`rounded-lg border px-3 py-2 text-sm ${item.data.ready
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                    : "border-amber-200 bg-amber-50 text-amber-800"
                                    }`}
                            >
                                <p className="font-medium">{item.label}: {item.data.ready ? "Connected" : "Not connected"}</p>
                                <p className="text-xs mt-1 opacity-90">{item.data.detail}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">Could not load personalization status.</p>
                )}
            </div>

            {!results && !isAnalyzing && (
                <div className="bg-white p-12 rounded-xl border border-dashed text-center shadow-sm">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search size={32} />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Ready to find your next role?</h2>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto">
                        We'll analyze your resume to identify the best job titles, keywords, and search strategies. Then we'll find real job listings for you.
                    </p>
                    <button
                        onClick={handleAnalyze}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-full font-medium hover:bg-blue-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                        <Sparkles size={18} />
                        Analyze My Profile
                    </button>
                    {error && (
                        <div className="mt-6 flex items-center justify-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg max-w-md mx-auto">
                            <AlertCircle size={16} />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}
                </div>
            )}

            {isAnalyzing && (
                <div className="bg-white p-12 rounded-xl border text-center shadow-sm">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <h2 className="text-lg font-medium text-slate-900">Analyzing your profile...</h2>
                    <p className="text-slate-500">Identifying skills, experience, and target roles.</p>
                </div>
            )}

            {results && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-semibold text-lg text-slate-900 mb-4">Search Filters</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Locations (Dropdown)</label>
                                <div className="flex gap-2">
                                    <select
                                        value={selectedLocationOption}
                                        onChange={(e) => setSelectedLocationOption(e.target.value)}
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm bg-white"
                                    >
                                        {LOCATION_OPTIONS.map((loc) => (
                                            <option key={loc} value={loc}>{loc}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const loc = selectedLocationOption.trim();
                                            if (!loc) return;
                                            setFilters((prev) => ({
                                                ...prev,
                                                locations: prev.locations.includes(loc) ? prev.locations : [...prev.locations, loc],
                                            }));
                                        }}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                                    >
                                        Add
                                    </button>
                                </div>
                                {filters.locations.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {filters.locations.map((loc) => (
                                            <button
                                                key={loc}
                                                type="button"
                                                onClick={() => setFilters((prev) => ({ ...prev, locations: prev.locations.filter((x) => x !== loc) }))}
                                                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700"
                                            >
                                                {loc} ×
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Extra Keywords</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={keywordInput}
                                        onChange={(e) => setKeywordInput(e.target.value)}
                                        placeholder="e.g. fintech, kubernetes, startup"
                                        className="w-full rounded-md border border-slate-300 p-2 text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const kw = keywordInput.trim();
                                            if (!kw) return;
                                            setFilters((prev) => ({
                                                ...prev,
                                                keywords: prev.keywords.includes(kw) ? prev.keywords : [...prev.keywords, kw],
                                            }));
                                            setKeywordInput("");
                                        }}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                                    >
                                        Add
                                    </button>
                                </div>
                                {filters.keywords.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {filters.keywords.map((kw) => (
                                            <button
                                                key={kw}
                                                type="button"
                                                onClick={() => setFilters((prev) => ({ ...prev, keywords: prev.keywords.filter((x) => x !== kw) }))}
                                                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                                            >
                                                {kw} ×
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Experience Level</label>
                                <select
                                    value={filters.level}
                                    onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm bg-white"
                                >
                                    <option value="">Any level</option>
                                    <option value="Internship">Internship</option>
                                    <option value="Entry Level">Entry Level</option>
                                    <option value="Mid Level">Mid Level</option>
                                    <option value="Senior Level">Senior Level</option>
                                    <option value="Management">Management</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Minimum Relevance</label>
                                <select
                                    value={filters.minRelevance}
                                    onChange={(e) => setFilters(prev => ({ ...prev, minRelevance: Number(e.target.value) }))}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm bg-white"
                                >
                                    <option value={0}>Show all</option>
                                    <option value={1}>Low+</option>
                                    <option value={2}>Medium+</option>
                                    <option value={3}>High+</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Posted Within</label>
                                <select
                                    value={filters.postedWithinDays}
                                    onChange={(e) => setFilters(prev => ({ ...prev, postedWithinDays: Number(e.target.value) }))}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm bg-white"
                                >
                                    <option value={7}>Last 7 days</option>
                                    <option value={14}>Last 14 days</option>
                                    <option value={30}>Last 30 days</option>
                                    <option value={90}>Last 90 days</option>
                                    <option value={0}>Any time</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Relocation</label>
                                <select
                                    value={filters.relocation}
                                    onChange={(e) => setFilters(prev => ({ ...prev, relocation: e.target.value as "any" | "yes" | "no" }))}
                                    className="w-full rounded-md border border-slate-300 p-2 text-sm bg-white"
                                >
                                    <option value="any">Any</option>
                                    <option value="yes">Willing to relocate</option>
                                    <option value="no">Not willing to relocate</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2 mt-7 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={filters.remoteOnly}
                                    onChange={(e) => setFilters(prev => ({ ...prev, remoteOnly: e.target.checked }))}
                                    className="rounded border-slate-300"
                                />
                                Remote only
                            </label>
                            <label className="flex items-center gap-2 mt-7 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={filters.usOnly}
                                    onChange={(e) => setFilters(prev => ({ ...prev, usOnly: e.target.checked }))}
                                    className="rounded border-slate-300"
                                />
                                Prioritize US jobs
                            </label>
                        </div>
                        <p className="text-xs text-slate-500 mt-3">
                            Filters apply when you click <span className="font-medium">Find Jobs</span> on any strategy.
                        </p>
                    </div>

                    {/* Job Titles */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                                <Briefcase className="text-purple-500" /> Recommended Titles
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {results.recommendedTitles.map((title: string) => (
                                    <span key={title} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-medium border border-purple-100">
                                        {title}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border shadow-sm">
                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                                <Sliders className="text-green-500" /> High-Value Keywords
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {results.searchKeywords.map((keyword: string) => (
                                    <span key={keyword} className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Reasoning */}
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-blue-900">
                        <h3 className="font-semibold mb-2">Strategy Insight</h3>
                        <p className="text-sm leading-relaxed opacity-90">{results.reasoning}</p>
                    </div>

                    {/* Search Queries with Jobs Below Each */}
                    <div className="space-y-6">
                        <h3 className="font-semibold text-lg text-slate-900">Search Strategies</h3>
                        {results.booleanQueries.map((item: any, i: number) => (
                            <div key={i} className="space-y-4">
                                <div className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-slate-900">{item.label}</h4>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {formatQueryForDisplay(item.query).map((part, idx) => (
                                                    <span key={`${item.label}-${idx}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                                        {part}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500">Search strategy built from your profile signals.</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={() => handleSearchJobs(item.query, i)}
                                            disabled={loadingQuery === i}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                                        >
                                            {loadingQuery === i ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            {loadingQuery === i ? 'Searching...' : 'Find Jobs'}
                                        </button>
                                        <a href={getSearchLink('linkedin', item.query)} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-4 py-2 bg-[#0077b5] text-white rounded text-sm font-medium hover:opacity-90 transition">
                                            LinkedIn <ExternalLink size={14} />
                                        </a>
                                        <a href={getSearchLink('indeed', item.query)} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-4 py-2 bg-[#2164f3] text-white rounded text-sm font-medium hover:opacity-90 transition">
                                            Indeed <ExternalLink size={14} />
                                        </a>
                                        <a href={getSearchLink('google', item.query)} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition">
                                            Google Jobs <ExternalLink size={14} />
                                        </a>
                                        <a href={getSearchLink('company', item.query)} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition">
                                            Company Sites <ExternalLink size={14} />
                                        </a>
                                    </div>

                                    {/* Show error if search failed */}
                                    {error && loadingQuery !== i && (
                                        <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                                            <AlertCircle size={16} />
                                            {error}
                                        </div>
                                    )}

                                    {/* Show loading state */}
                                    {loadingQuery === i && (
                                        <div className="mt-3 flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg text-sm">
                                            <Loader2 size={16} className="animate-spin" />
                                            Searching for jobs...
                                        </div>
                                    )}
                                </div>

                                {/* Show jobs for this specific query */}
                                {jobsByQuery[i] && (
                                    <div className="ml-6 pl-6 border-l-2 border-blue-200">
                                        <JobSearchResults jobs={jobsByQuery[i]} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="text-center pt-8">
                        <button
                            onClick={handleAnalyze}
                            className="text-slate-500 hover:text-slate-900 text-sm font-medium underline"
                        >
                            Regenerate Analysis
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
