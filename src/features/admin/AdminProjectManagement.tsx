import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { supabase } from '../../supabaseClient';

type Project = {
    id: string;
    name: string;
    assignees?: string[] | null;
    created_at?: string | null;
    created_by?: string | null;
    creator_email?: string | null;
    networks?: any[] | null;
};

export default function AdminProjectManagement() {
    const [projects, setProjects] = useState<Project[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        // get current authenticated user email (if any)
        (async () => {
            try {
                const { data } = await supabase.auth.getUser();
                const user = data?.user ?? null;
                if (mounted && user?.email) setCurrentUserEmail(user.email);
            } catch (e) {
                // ignore
            }
        })();

        const fetchProjects = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { data, error } = await supabase.from('projects').select(`id, name, assignees, created_at, created_by, creator_email, networks`);
                if (!mounted) return;
                if (error) {
                    setError(error.message || String(error));
                    setProjects(null);
                } else {
                    setProjects((data as any) ?? []);
                }
            } catch (err: any) {
                if (!mounted) return;
                setError(err?.message || String(err));
                setProjects(null);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        fetchProjects();
        return () => { mounted = false };
    }, []);

    return (
        <div className="p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Projects</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && <div className="text-sm text-muted-foreground">Loading projects...</div>}
                    {error && <div className="text-sm text-red-600">{error}</div>}

                    {!isLoading && !error && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Project name</TableHead>
                                    <TableHead>Creator</TableHead>
                                    <TableHead>Created at</TableHead>
                                    <TableHead>Networks</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                                        <TableBody>
                                            {(projects || []).map((p) => (
                                                <TableRow key={p.id}>
                                                    <TableCell className="font-medium">{p.name}</TableCell>
                                                    <TableCell>
                                                        {p.creator_email ?? p.created_by ?? '-'}
                                                        {currentUserEmail && (p.creator_email === currentUserEmail || p.created_by === currentUserEmail) && (
                                                            <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{p.created_at ? new Date(p.created_at).toLocaleString() : '-'}</TableCell>
                                                    <TableCell>{Array.isArray(p.networks) ? p.networks.length : 0}</TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            <Button variant="ghost" size="sm">View</Button>
                                                            <Button variant="outline" size="sm">Edit</Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                        </Table>
                    )}

                    {(!isLoading && projects && projects.length === 0) && (
                        <div className="mt-4 text-muted-foreground">No projects found.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}