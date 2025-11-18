import Hamburger from "@/components/ui/hamburger";
import { useUserFlags } from "@/hooks/useUserFlags";


const Bookings = () => {
    useUserFlags();
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