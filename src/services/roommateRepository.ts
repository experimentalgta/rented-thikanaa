import { IRoommateRepository } from './contracts';
import { StudentProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export class RoommateRepository implements IRoommateRepository {
  private assertSupabaseClient() {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error(
        'Supabase is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
      );
    }
    return supabase;
  }

  private mapRowToStudentProfile(row: any): StudentProfile {
    const userProfile = row.user || {};
    return {
      id: row.id,
      user_id: row.user_id,
      full_name: userProfile.full_name || 'Student Aspirant',
      avatar_url: userProfile.avatar_url,
      gender: row.gender || 'male',
      college: row.college || 'Allahabad University',
      course: row.course || 'Civil Services Aspirant',
      academic_year: row.academic_year || 'Preparing for Exams',
      target_move_in: row.target_move_in || 'Immediately',
      budget_min: Number(row.budget_min) || 3500,
      budget_max: Number(row.budget_max) || 6500,
      preferred_areas: Array.isArray(row.preferred_areas) ? row.preferred_areas : ['Katra'],
      lifestyle: row.lifestyle || {
        sleep_schedule: 'early_bird',
        dietary: 'veg',
        smoking: 'non_smoker',
        quiet_study: true,
        cleanliness: 'high',
        visitors: 'rare',
      },
      bio: row.bio || userProfile.bio || '',
      phone_privacy: userProfile.phone_privacy || 'on_request',
      phone_number: userProfile.phone_privacy === 'public' ? userProfile.phone_number : undefined,
      is_demo: Boolean(row.is_demo),
    };
  }

  calculateCompatibility(
    profileA: Partial<StudentProfile>,
    profileB: Partial<StudentProfile>
  ): { score: number; breakdown: { factor: string; matched: boolean; description: string }[] } {
    const breakdown: { factor: string; matched: boolean; description: string }[] = [];
    let score = 0;

    // 1. Budget Overlap (25 pts)
    const minA = profileA.budget_min || 4000;
    const maxA = profileA.budget_max || 6000;
    const minB = profileB.budget_min || 4000;
    const maxB = profileB.budget_max || 6000;

    const hasOverlap = Math.max(minA, minB) <= Math.min(maxA, maxB) + 500;
    if (hasOverlap) {
      score += 25;
      breakdown.push({
        factor: 'Budget Overlap',
        matched: true,
        description: `Compatible rent ranges (₹${minB.toLocaleString('en-IN')} - ₹${maxB.toLocaleString('en-IN')})`,
      });
    } else {
      breakdown.push({
        factor: 'Budget Range',
        matched: false,
        description: `Different target budgets`,
      });
    }

    // 2. Smoking Habit (15 pts) - Strict compatibility
    const smokeA = profileA.lifestyle?.smoking || 'non_smoker';
    const smokeB = profileB.lifestyle?.smoking || 'non_smoker';
    if (smokeA === smokeB) {
      score += 15;
      breakdown.push({
        factor: 'Smoking Preference',
        matched: true,
        description: smokeA === 'non_smoker' ? 'Both prefer a smoke-free room' : 'Smoking habits match',
      });
    } else {
      breakdown.push({
        factor: 'Smoking Preference',
        matched: false,
        description: 'Differing smoking preferences',
      });
    }

    // 3. Sleep Routine (15 pts)
    const sleepA = profileA.lifestyle?.sleep_schedule || 'early_bird';
    const sleepB = profileB.lifestyle?.sleep_schedule || 'early_bird';
    if (sleepA === sleepB || sleepA === 'flexible' || sleepB === 'flexible') {
      score += 15;
      breakdown.push({
        factor: 'Sleep Schedule',
        matched: true,
        description: sleepA === sleepB ? `Both are ${sleepA.replace('_', ' ')}s` : 'Flexible sleep routines',
      });
    } else {
      breakdown.push({
        factor: 'Sleep Schedule',
        matched: false,
        description: `${sleepA.replace('_', ' ')} vs ${sleepB.replace('_', ' ')}`,
      });
    }

    // 4. Dietary Habits (15 pts)
    const dietA = profileA.lifestyle?.dietary || 'veg';
    const dietB = profileB.lifestyle?.dietary || 'veg';
    if (dietA === dietB || (dietA === 'non_veg' && dietB === 'veg')) {
      const matchScore = dietA === dietB ? 15 : 10;
      score += matchScore;
      breakdown.push({
        factor: 'Food & Cooking',
        matched: true,
        description: dietA === dietB ? `Shared ${dietA} food preference` : 'Compatible food habits',
      });
    } else {
      breakdown.push({
        factor: 'Food & Cooking',
        matched: false,
        description: 'Differing dietary requirements',
      });
    }

    // 5. Quiet Study Focus (15 pts)
    const studyA = profileA.lifestyle?.quiet_study ?? true;
    const studyB = profileB.lifestyle?.quiet_study ?? true;
    if (studyA === studyB) {
      score += 15;
      breakdown.push({
        factor: 'Study Atmosphere',
        matched: true,
        description: studyA ? 'Both value silent, focused study hours' : 'Shared casual atmosphere',
      });
    } else {
      breakdown.push({
        factor: 'Study Atmosphere',
        matched: false,
        description: 'Different study hour expectations',
      });
    }

    // 6. Preferred Area / College Proximity (15 pts)
    const areasA = profileA.preferred_areas || ['Katra'];
    const areasB = profileB.preferred_areas || ['Katra'];
    const sharedArea = areasA.some((a) => areasB.includes(a));
    if (sharedArea) {
      score += 15;
      breakdown.push({
        factor: 'Location Match',
        matched: true,
        description: `Both interested in ${areasB.filter((a) => areasA.includes(a)).join(', ')}`,
      });
    } else {
      score += 5;
      breakdown.push({
        factor: 'Location Match',
        matched: false,
        description: 'Different primary area targets',
      });
    }

    return {
      score: Math.min(98, Math.max(45, score)),
      breakdown,
    };
  }

  async getRoommates(
    filters?: {
      gender?: string;
      locality?: string;
      maxBudget?: number;
      dietary?: string;
      smoking?: string;
    },
    referenceProfile?: Partial<StudentProfile>
  ): Promise<StudentProfile[]> {
    const client = this.assertSupabaseClient();

    let query = client
      .from('student_profiles')
      .select(`
        *,
        user:profiles!student_profiles_user_id_fkey (
          id,
          full_name,
          avatar_url,
          phone_number,
          phone_privacy,
          bio
        )
      `);

    if (filters?.maxBudget) {
      query = query.lte('budget_min', filters.maxBudget);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch roommates from Supabase: ${error.message}`);
    }

    let roommates = (data || []).map((row) => this.mapRowToStudentProfile(row));

    if (filters?.gender && filters.gender !== 'any') {
      roommates = roommates.filter((r) => r.gender === filters.gender);
    }
    if (filters?.locality && filters.locality !== 'all') {
      const q = filters.locality.trim().toLowerCase();
      roommates = roommates.filter((r) =>
        r.preferred_areas.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))
      );
    }
    if (filters?.dietary && filters.dietary !== 'all') {
      roommates = roommates.filter((r) => r.lifestyle.dietary === filters.dietary);
    }
    if (filters?.smoking && filters.smoking !== 'all') {
      roommates = roommates.filter((r) => r.lifestyle.smoking === filters.smoking);
    }

    // Compute compatibility scores against reference profile
    const benchmark: Partial<StudentProfile> = referenceProfile || {
      budget_min: 4000,
      budget_max: 6000,
      preferred_areas: ['Katra', 'Mumfordganj'],
      lifestyle: {
        sleep_schedule: 'night_owl',
        dietary: 'veg',
        smoking: 'non_smoker',
        quiet_study: true,
        cleanliness: 'high',
        visitors: 'rare',
      },
    };

    const scored = roommates.map((r) => {
      const { score, breakdown } = this.calculateCompatibility(benchmark, r);
      return {
        ...r,
        compatibility_score: score,
        compatibility_breakdown: breakdown,
      };
    });

    // Sort by highest compatibility match
    scored.sort((a, b) => (b.compatibility_score || 0) - (a.compatibility_score || 0));

    return scored;
  }

  async getRoommateById(id: string): Promise<StudentProfile | null> {
    const client = this.assertSupabaseClient();

    const { data, error } = await client
      .from('student_profiles')
      .select(`
        *,
        user:profiles!student_profiles_user_id_fkey (
          id,
          full_name,
          avatar_url,
          phone_number,
          phone_privacy,
          bio
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch roommate profile: ${error.message}`);
    }
    if (!data) return null;

    return this.mapRowToStudentProfile(data);
  }
}

export const roommateRepository = new RoommateRepository();
