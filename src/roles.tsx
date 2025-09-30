import { supabase } from "./supabaseClient";

export async function fetchRoleNames(): Promise<string[]> {
    const { data, error } = await supabase
        .from('roles')
        .select('name');

    if (error) {
        console.error('Error fetching roles:', error);
        return [];
    }
    console.log('Fetched roles:', data);
    return data ? data.map((role: { name: string }) => role.name) : [];

}