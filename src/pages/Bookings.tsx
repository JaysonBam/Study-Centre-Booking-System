import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import timeLib from "@/lib/time";
import { useUserFlags } from "@/hooks/useUserFlags";
import TopToolbar from "@/components/bookings/TopToolbar";
import BookingGrid from "@/components/bookings/BookingGrid";
import BookingPanel from "@/components/bookings/BookingPanel";

const Bookings = () => {
    useUserFlags();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    // On mount, if testing clock is enabled in settings, use that time/date as the selectedDate
    useEffect(() => {
        (async () => {
            try {
                const t = await timeLib.getTime();
                setSelectedDate(t);
            } catch (e) {
                // ignore and keep system date
            }
        })();
    }, []);
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelData, setPanelData] = useState<any>(null);

    const handleBookClick = async () => {
        // open panel with current time rounded to nearest 30 minutes (no room selected)
        const now = await timeLib.getTime();
        const mins = now.getMinutes();
        const rem = mins % 30;
        if (rem < 15) now.setMinutes(mins - rem);
        else now.setMinutes(mins + (30 - rem));
        now.setSeconds(0, 0);
        setPanelData({ timeSlot: now.toISOString() });
        setPanelOpen(true);
    };

    const handleCellClick = (roomId: string, timeSlotIso: string) => {
        setPanelData({ roomId, timeSlot: timeSlotIso });
        setPanelOpen(true);
    };

    const handleBookingClick = (bookingId: string) => {
        // fetch booking details and open panel in edit mode
        (async () => {
            try {
                const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
                if (error) {
                    console.error('Error fetching booking', error);
                    // still open panel with id only as fallback
                    setPanelData({ bookingId });
                } else {
                    setPanelData({ booking: data });
                }
            } catch (e) {
                console.error('Failed to load booking', e);
                setPanelData({ bookingId });
            } finally {
                setPanelOpen(true);
            }
        })();
    };

    return (
        <div className="min-h-screen bg-background">
            <TopToolbar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onBookClick={handleBookClick}
            />

            <div className="p-4">
                <BookingGrid
                    selectedDate={selectedDate}
                    onCellClick={handleCellClick}
                    onBookingClick={handleBookingClick}
                />
            </div>

            <BookingPanel
                open={panelOpen}
                onClose={() => { setPanelOpen(false); setPanelData(null); }}
                prefill={panelData}
            />
        </div>
    );
};

export default Bookings;