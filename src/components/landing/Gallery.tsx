"use client";

const imagesRow1 = [
  "https://picsum.photos/seed/cyberpunk/600/400",
  "https://picsum.photos/seed/fantasy/400/600",
  "https://picsum.photos/seed/scifi/600/400",
  "https://picsum.photos/seed/nature/400/600",
  "https://picsum.photos/seed/portrait/600/400",
];

const imagesRow2 = [
  "https://picsum.photos/seed/abstract/400/600",
  "https://picsum.photos/seed/architecture/600/400",
  "https://picsum.photos/seed/space/400/600",
  "https://picsum.photos/seed/neon/600/400",
  "https://picsum.photos/seed/surreal/400/600",
];

export function Gallery() {
  return (
    <section id="gallery" className="py-24 overflow-hidden bg-black relative">
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />

      <div className="mb-16 px-6 md:px-12 max-w-7xl mx-auto text-center relative z-20">
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Made with DreamSun</h2>
        <p className="text-white/60 text-lg max-w-2xl mx-auto">Explore the limitless possibilities of AI-assisted creation.</p>
      </div>

      <div className="flex flex-col gap-6 relative z-0">
        {/* Row 1 - Moving Left */}
        <div className="flex gap-6 w-max animate-marquee">
          {[...imagesRow1, ...imagesRow1].map((src, i) => (
            <div key={i} className="relative w-[300px] h-[200px] md:w-[450px] md:h-[300px] rounded-2xl overflow-hidden shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Gallery"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
            </div>
          ))}
        </div>

        {/* Row 2 - Moving Right */}
        <div className="flex gap-6 w-max animate-marquee-reverse">
          {[...imagesRow2, ...imagesRow2].map((src, i) => (
            <div key={i} className="relative w-[250px] h-[350px] md:w-[350px] md:h-[450px] rounded-2xl overflow-hidden shrink-0 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="Gallery"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
