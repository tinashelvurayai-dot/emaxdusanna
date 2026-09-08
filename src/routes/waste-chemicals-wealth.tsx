import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Clock, Recycle } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { specialCourseCatalog, specialCourseLanguage, WASTE_CHEMICALS_WEALTH } from "@/lib/special-courses";
import { getCourseContent } from "@/lib/courses";
import { WASTE_CHEMICALS_WEALTH_PRICE } from "@/lib/pricing";
import { pageHead } from "@/lib/site";
import { getCourseImage } from "@/lib/course-images";

export const Route = createFileRoute("/waste-chemicals-wealth")({
  head: () => pageHead({ title: `${WASTE_CHEMICALS_WEALTH.name} | Edusanna`, description: WASTE_CHEMICALS_WEALTH.description, path: "/waste-chemicals-wealth" }),
  component: WasteChemicalsWealthPage,
});

function WasteChemicalsWealthPage() {
  const courses = specialCourseCatalog.filter((course) => ["waste-chemicals-wealth", "entrepreneuriat-dechets-produits-chimiques"].includes(course.id));
  return (
    <div className="min-h-screen">
      <SiteNavbar />
      <section className="pt-32 pb-10 px-4 sm:px-6 lg:px-8"><div className="max-w-5xl mx-auto text-center">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1"><Recycle className="w-3.5 h-3.5" aria-hidden="true" /> Certificate program</span>
        <h1 className="text-4xl md:text-5xl font-black mt-4"><span className="gradient-text">{WASTE_CHEMICALS_WEALTH.name}</span></h1>
        <p className="text-lg text-blue-700 mt-3">{WASTE_CHEMICALS_WEALTH.tagline}</p>
        <p className="text-blue-700 max-w-3xl mx-auto mt-4 leading-relaxed">{WASTE_CHEMICALS_WEALTH.description}</p>
        <span className="inline-flex items-center gap-1 mt-6 font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700"><Award className="w-4 h-4" aria-hidden="true" /> $15 USD certificate fee</span>
      </div></section>
      <section className="pb-20 px-4 sm:px-6 lg:px-8"><div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((course) => { const content = getCourseContent(course.id, "certificate"); return <Link key={course.id} to="/course/$id" params={{ id: course.id }} className="course-card p-6 block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><img src={getCourseImage({ id: course.id, category: course.category })} alt={course.diplomaTitle} className="w-full h-36 rounded-xl object-cover mb-4" loading="lazy" /><span className="text-xs font-bold uppercase tracking-wide text-emerald-700">{specialCourseLanguage[course.id]}</span><h2 className="text-lg font-bold text-blue-900 mt-2">{course.diplomaTitle}</h2>{content?.description && <p className="text-sm text-blue-600 mt-2 line-clamp-4">{content.description}</p>}<div className="flex items-center gap-2 mt-4"><span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700"><Clock className="w-3 h-3" aria-hidden="true" /> Certificate</span><span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700">$15 USD</span></div></Link>; })}
      </div></section>
      <SiteFooter />
    </div>
  );
}
