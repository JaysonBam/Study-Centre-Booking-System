// navigation not used in this page; hamburger handles navigation
import Hamburger from "@/components/ui/hamburger";
import { useUserFlags } from "@/hooks/useUserFlags";

// user row shape is provided by `useUserFlags` hook; keep this file minimal

const Bookings = () => {
    useUserFlags();

    // user/flags are provided by useUserFlags (which also enforces access); no local load required


    return (
        <main className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Hamburger />
                    <h1 className="text-2xl font-semibold">Bookings</h1>
                </div>
            </div>
        </main>
    );
};

export default Bookings;