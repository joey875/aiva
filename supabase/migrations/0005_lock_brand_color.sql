-- Lock every company to the single Aiva brand blue so the app always looks uniform.
update public.companies set brand_color = '#0176D3';
alter table public.companies alter column brand_color set default '#0176D3';
