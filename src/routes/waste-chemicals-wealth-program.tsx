import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Clock, Leaf } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { specialCourseCatalog, specialCourseLanguage, WASTE_WEALTH_PROGRAM } from "@/lib/special-courses";
import { getCourseImage } from "@/lib/course-images";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/waste-chemicals-wealth-program")({
  head: () => pageHead({ title: `${WASTE_WEALTH_PROGRAM.name} | Edusanna`, description: WASTE_WEALTH_PROGRAM.description, path: "/waste-chemicals-wealth-program" }),
  component: WasteWealthProgramPage,
});

function WasteWealthProgramPage() {
  const courses = specialCourseCatalog.filter((course) => course.id.includes("waste") || course.id.includes("dechets"));
  return <div className="min-h-screen"><SiteNavbar /><main className="pt-32 pb-20 px-4 sm:px-6 lg:px-8"><div className="max-w-5xl mx-auto"><div className="text-center mb-10"><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1"><Leaf className="w-3.5 h-3.5" aria-hidden="true" /> Certificate programme</span><h1 className="text-4xl md:text-5xl font-black mt-4"><span className="gradient-text">{WASTE_WEALTH_PROGRAM.name}</span></h1><p className="text-lg text-blue-700 mt-3">{WASTE_WEALTH_PROGRAM.tagline}</p><p className="max-w-2xl mx-auto mt-4 text-blue-600 leading-relaxed">{WASTE_WEALTH_PROGRAM.description}</p><span className="inline-flex mt-5 text-sm font-bold px-4 py-2 rounded-full bg-green-50 text-green-700">$15 USD certificate fee</span></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{courses.map((course) => <Link key={course.id} to="/course/$id" params={{ id: course.id }} className="course-card p-6 block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"><img src={getCourseImage(course)} alt={`${course.certificateTitle} course cover`} width={640} height={360} loading="eager" decoding="async" className="w-full h-44 rounded-2xl object-cover mb-5" /><span className="text-xs font-bold uppercase tracking-wide text-emerald-700">{specialCourseLanguage[course.id]}</span><h2 className="text-xl font-bold text-blue-900 mt-1">{course.certificateTitle}</h2><div className="flex items-center gap-2 mt-4"><span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700"><Clock className="w-3 h-3" aria-hidden="true" /> Self-paced</span><span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700"><Award className="w-3 h-3" aria-hidden="true" /> Certificate</span></div></Link>)}</div></div></main><SiteFooter /></div>;
}
