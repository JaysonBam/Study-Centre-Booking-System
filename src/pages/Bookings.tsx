import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import timeLib from "@/lib/time";
import { useUserFlags } from "@/hooks/useUserFlags";
import TopToolbar from "@/components/bookings/TopToolbar";
import BookingGrid from "@/components/bookings/BookingGrid";
import BookingPanel from "@/components/bookings/BookingPanel";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/context/ConfirmDialogContext";

const Bookings = () => {
    useUserFlags();
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentUser, setCurrentUser] = useState<string>("");

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

    const handleQuickAction = async (bookingId: string, action: 'activate' | 'end') => {
        try {
            const newState = action === 'activate' ? 'Active' : 'Ended';

            if (action === 'end') {
                const { data: booking, error: fetchError } = await supabase
                    .from('bookings')
                    .select('borrowed_items')
                    .eq('id', bookingId)
                    .single();

                if (fetchError) throw fetchError;

                if (booking?.borrowed_items && booking.borrowed_items.length > 0) {
                    const lowercasedItems = booking.borrowed_items.map((item: string) => item.toLowerCase());
                    const itemsList = lowercasedItems.join(', ');
                    const lastIndex = itemsList.lastIndexOf(', ');
                    const formattedList = lastIndex !== -1 
                        ? itemsList.substring(0, lastIndex) + ' and ' + itemsList.substring(lastIndex + 2)
                        : itemsList;
                    
                    const verb = lowercasedItems.length === 1 ? 'Is' : 'Are';
                    const returned = await confirm({
                        title: "Confirm Return",
                        description: `${verb} ${formattedList} returned?`,
                        confirmText: "Yes",
                        cancelText: "No",
                    });
                    if (!returned) return;
                }
            }

            const { error } = await supabase
                .from('bookings')
                .update({ state: newState })
                .eq('id', bookingId);

            if (error) throw error;
            
            toast({ title: "Success", description: `Booking ${newState.toLowerCase()}` });
        } catch (err: any) {
            console.error("Quick action failed", err);
            toast({ title: "Error", description: "Failed to update booking" });
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <TopToolbar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                onBookClick={handleBookClick}
                currentUser={currentUser}
                onUserChange={setCurrentUser}
            />

            <div className="p-4">
                <BookingGrid
                    selectedDate={selectedDate}
                    onCellClick={handleCellClick}
                    onBookingClick={handleBookingClick}
                    onQuickAction={handleQuickAction}
                />
            </div>

            <BookingPanel
                open={panelOpen}
                onClose={() => { setPanelOpen(false); setPanelData(null); }}
                prefill={panelData}
                defaultStaffName={currentUser}
            />
        </div>
    );
};

export default Bookings;