import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const animateOnScroll = (elements, options = {}) => {
    if (!elements) return;

    const targets = Array.isArray(elements) ? elements : [elements];

    targets.forEach((el) => {
        if (!el) return;

        gsap.fromTo(el,
            {
                opacity: 0,
                y: options.y || 50,
                scale: options.scale || 0.95
            },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: options.duration || 1,
                delay: options.delay || 0,
                ease: options.ease || "power3.out",
                scrollTrigger: {
                    trigger: el,
                    start: options.start || "top 85%",
                    toggleActions: "play none none none"
                }
            }
        );
    });
};

export const staggerAnimate = (parent, childrenSelector, options = {}) => {
    if (!parent) return;

    const children = parent.querySelectorAll(childrenSelector);
    if (!children.length) return;

    gsap.fromTo(children,
        {
            opacity: 0,
            y: options.y || 30,
            scale: options.scale || 0.9
        },
        {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: options.duration || 0.8,
            stagger: options.stagger || 0.1,
            ease: "power2.out",
            scrollTrigger: {
                trigger: parent,
                start: options.start || "top 80%",
                toggleActions: "play none none none"
            }
        }
    );
};

export const parallaxElement = (element, speed = 0.5) => {
    if (!element) return;

    gsap.to(element, {
        y: speed * 100,
        ease: "none",
        scrollTrigger: {
            trigger: element,
            start: "top bottom",
            end: "bottom top",
            scrub: true
        }
    });
};
