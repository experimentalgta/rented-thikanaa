import React, { useState, useEffect } from 'react';
import { Users, Filter, Sparkles, MapPin, Search, ShieldCheck } from 'lucide-react';
import { RoommateCard } from '../components/roommate/RoommateCard';
import { StudentProfile } from '../types';
import { roommateRepository } from '../services/roommateRepository';
import { useChat } from '../context/ChatContext';
import { ContactRequestModal } from '../components/safety/ContactRequestModal';

export const RoommatePage: React.FC = () => {
  const [roommates, setRoommates] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [genderFilter, setGenderFilter] = useState('any');
  const [dietaryFilter, setDietaryFilter] = useState('all');
  const [smokingFilter, setSmokingFilter] = useState('all');
  const [localityFilter, setLocalityFilter] = useState('all');
  const [maxBudget, setMaxBudget] = useState(8000);

  const { openChatWithContext } = useChat();

  const fetchRoommates = async () => {
    setLoading(true);
    try {
      const data = await roommateRepository.getRoommates({
        gender: genderFilter !== 'any' ? genderFilter : undefined,
        dietary: dietaryFilter !== 'all' ? dietaryFilter : undefined,
        smoking: smokingFilter !== 'all' ? smokingFilter : undefined,
        locality: localityFilter !== 'all' ? localityFilter : undefined,
        maxBudget,
      });
      setRoommates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoommates();
  }, [genderFilter, dietaryFilter, smokingFilter, localityFilter, maxBudget]);

  const handleMessage = (roommate: StudentProfile) => {
    openChatWithContext({
      id: `roommate-${roommate.id}`,
      title: `Roommate Inquiry: ${roommate.full_name}`,
      locality: roommate.preferred_areas[0] || 'Katra',
      rent: roommate.budget_min,
      owner_id: roommate.user_id,
      owner_name: roommate.full_name,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#101828] to-[#172554] text-white rounded-3xl p-6 sm:p-10 mb-8 border border-[#1E293B]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#F59E0B] text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Compatibility Matching</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black font-heading tracking-tight mb-3">
            Find Your Student Roommate in Prayagraj
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] leading-relaxed">
            Connect with students from Allahabad University, CMP, MNNIT, and civil services coaching hubs. Match on lifestyle, sleep habits, diet, and budget with privacy-first contact.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-8 shadow-xs flex flex-wrap items-center gap-3">
        {/* Gender Filter */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">
            Looking For
          </label>
          <div className="flex gap-1">
            {[
              { id: 'any', label: 'All' },
              { id: 'male', label: 'Male' },
              { id: 'female', label: 'Female' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGenderFilter(g.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  genderFilter === g.id
                    ? 'bg-[#101828] text-white'
                    : 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Locality Filter */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">
            Area Target
          </label>
          <select
            value={localityFilter}
            onChange={(e) => setLocalityFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#111827] focus:outline-none"
          >
            <option value="all">Any Locality</option>
            <option value="Katra">Katra</option>
            <option value="Civil Lines">Civil Lines</option>
            <option value="Mumfordganj">Mumfordganj</option>
            <option value="George Town">George Town</option>
            <option value="University Area">University Area</option>
          </select>
        </div>

        {/* Dietary */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">
            Dietary Habit
          </label>
          <select
            value={dietaryFilter}
            onChange={(e) => setDietaryFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#111827] focus:outline-none"
          >
            <option value="all">Any Diet</option>
            <option value="veg">Vegetarian</option>
            <option value="non_veg">Non-Veg Allowed</option>
          </select>
        </div>

        {/* Smoking */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-1">
            Smoking
          </label>
          <select
            value={smokingFilter}
            onChange={(e) => setSmokingFilter(e.target.value)}
            className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#111827] focus:outline-none"
          >
            <option value="all">Any</option>
            <option value="non_smoker">Non-Smoker Only</option>
          </select>
        </div>
      </div>

      {/* Roommates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-72 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      ) : roommates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roommates.map((rm) => (
            <RoommateCard
              key={rm.id}
              roommate={rm}
              onMessage={handleMessage}
              onRequestContact={() => handleMessage(rm)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center">
          <Users className="w-10 h-10 text-[#CBD5E1] mx-auto mb-3" />
          <h3 className="font-bold text-base text-[#111827] font-heading mb-1">
            No roommates found matching these criteria
          </h3>
          <p className="text-xs text-[#667085] max-w-sm mx-auto">
            Try adjusting your filters or post your roommate requirement on your student dashboard.
          </p>
        </div>
      )}
    </div>
  );
};
