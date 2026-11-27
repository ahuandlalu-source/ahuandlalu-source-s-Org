import type {FamilyMember, Language} from '../types/wedding';
import {ScrollReveal} from './ScrollReveal';

interface FamilyDirectoryProps {
  members: FamilyMember[];
  language: Language;
  heading: string;
  subtitle?: string;
}

export function FamilyDirectory({
  members,
  language,
  heading,
  subtitle,
}: FamilyDirectoryProps) {
  const visibleMembers = [...members]
    .filter((m) => m.visible && m.name[language].trim().length > 0)
    .sort((a, b) => a.order - b.order);

  if (visibleMembers.length === 0) return null;

  const brideSide = visibleMembers.filter((m) => m.side === 'bride');
  const groomSide = visibleMembers.filter((m) => m.side === 'groom');

  return (
    <section
      id="family"
      aria-labelledby="family-heading"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-[#2C221E]/8"
    >
      <ScrollReveal className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-xs uppercase tracking-[0.18em] text-[#B68D40] mb-3">
          {language === 'ml' ? 'കുടുംബാംഗങ്ങൾ' : 'With Family Blessings'}
        </p>
        <h2
          id="family-heading"
          className="font-display text-3xl sm:text-4xl font-normal text-[#2C221E] text-balance"
        >
          {heading}
        </h2>
        {subtitle && (
          <p className="mt-3 text-sm sm:text-base text-[#5E4C45]">{subtitle}</p>
        )}
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
        {[
          {
            key: 'bride',
            title: language === 'ml' ? 'വധുവിന്റെ കുടുംബം' : "Bride's Family",
            items: brideSide,
          },
          {
            key: 'groom',
            title: language === 'ml' ? 'വരന്റെ കുടുംബം' : "Groom's Family",
            items: groomSide,
          },
        ]
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <ScrollReveal key={group.key}>
              <div className="bg-[#F4EFE6] border border-[#2C221E]/10 rounded-xl p-6 sm:p-8 h-full">
                <h3 className="font-display text-2xl text-[#2C221E] pb-4 border-b border-[#2C221E]/10 mb-5">
                  {group.title}
                </h3>
                <ul className="space-y-4">
                  {group.items.map((member) => (
                    <li
                      key={member.id}
                      className="pb-4 last:pb-0 border-b last:border-b-0 border-[#2C221E]/8"
                    >
                      <p className="text-base font-medium text-[#2C221E]">
                        {member.name[language]}
                      </p>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#7A675F] mt-0.5">
                        {member.relationship[language]}
                      </p>
                      {member.note?.[language] && (
                        <p className="text-sm text-[#5E4C45] mt-1.5 leading-relaxed">
                          {member.note[language]}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
      </div>
    </section>
  );
}
